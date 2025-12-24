import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client } from 'discord.js';
import { VoiceStateDTO } from '../infrastructure/voice-state.dto';
import { VoiceChannelPolicy } from './voice-channel.policy';
import { DiscordVoiceGateway } from '../infrastructure/discord-voice.gateway';
import { TempChannelStore } from '../infrastructure/temp-channel-store';
import { VoiceRedisRepository } from '../infrastructure/voice.redis.repository';
import { VoiceDailyFlushService } from './voice-daily-flush-service';
import { getKSTDateString } from 'src/common/helper';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);
  private readonly discord: DiscordVoiceGateway;

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    @Inject('TempChannelStore') private readonly tempChannelStore: TempChannelStore,
    private readonly policy: VoiceChannelPolicy,
    private readonly voiceRedisRepository: VoiceRedisRepository,
    private readonly voiceDailyFlushService: VoiceDailyFlushService,
  ) {
    this.discord = new DiscordVoiceGateway(this.client);
  }

  /**
   * ===============================
   * JOIN / UPDATE (공통 진입점)
   * ===============================
   */
  async handleVoiceStateUpdate(cmd: VoiceStateDTO) {
    const { guildId, userId } = cmd;
    const now = Date.now();
    const today = getKSTDateString();

    await this.voiceRedisRepository.setChannelName(guildId, cmd.channelId, cmd.channelName);
    await this.voiceRedisRepository.setUserName(guildId, cmd.userId, cmd.userName);

    let session = await this.voiceRedisRepository.getSession(guildId, userId);

    if (!session) {
      await this.voiceRedisRepository.setSession(guildId, userId, {
        channelId: cmd.channelId,
        joinedAt: now,
        lastUpdatedAt: now,
        mic: cmd.micOn,
        alone: cmd.alone,
        date: today,
      });
      return;
    }

    /**
     * ⭐ 날짜 변경
     */
    if (session.date !== today) {
      await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);
      await this.voiceDailyFlushService.flushDate(guildId, userId, session.date);

      session = {
        ...session,
        joinedAt: now,
        lastUpdatedAt: now,
        date: today,
      };
    }

    /**
     * 3️⃣ UPDATE (mic / alone / move)
     */
    await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);

    session.channelId = cmd.channelId ?? session.channelId;
    session.mic = cmd.micOn;
    session.alone = cmd.alone;
    session.lastUpdatedAt = now;

    await this.voiceRedisRepository.setSession(guildId, userId, session);
  }

  async onUserMove(oldCmd: VoiceStateDTO, newCmd: VoiceStateDTO) {
    const { guildId, userId } = newCmd;
    const now = Date.now();

    await this.voiceRedisRepository.setChannelName(guildId, newCmd.channelId, newCmd.channelName);
    await this.voiceRedisRepository.setUserName(guildId, newCmd.userId, newCmd.userName);
    const session = await this.voiceRedisRepository.getSession(guildId, userId);
    if (!session) {
      await this.voiceRedisRepository.setSession(guildId, userId, {
        channelId: newCmd.channelId,
        joinedAt: now,
        lastUpdatedAt: now,
        mic: newCmd.micOn,
        alone: newCmd.alone,
        date: getKSTDateString(),
      });
      return;
    }

    /**
     * 1️⃣ 🔒 이전 채널 정보 고정
     */
    const prevSession = {
      ...session,
      channelId: oldCmd.channelId,
      channelName: oldCmd.channelName,
    };

    /**
     * 2️⃣ 이전 채널 체류 시간 마감 (정확)
     */
    await this.voiceRedisRepository.accumulateDuration(guildId, userId, prevSession, now);

    /**
     * 3️⃣ 새 채널 세션 시작
     */
    const newSession = {
      ...session,
      channelId: newCmd.channelId,
      channelName: newCmd.channelName,
      userName: newCmd.userName,
      joinedAt: now,
      lastUpdatedAt: now,
      mic: newCmd.micOn,
      alone: newCmd.alone,
    };

    await this.voiceRedisRepository.setSession(guildId, userId, newSession);

    this.logger.debug(`[VOICE MOVE] ${userId} ${oldCmd.channelName} → ${newCmd.channelName}`);
  }
  /**
   * ===============================
   * LEAVE (세션 종료)
   * ===============================
   */
  async onUserLeave(cmd: VoiceStateDTO) {
    const { guildId, userId } = cmd;
    const now = Date.now();

    const session = await this.voiceRedisRepository.getSession(guildId, userId);
    if (!session) return;

    // 1️⃣ 마지막 상태 기준 누적
    await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);

    // 2️⃣ ⭐ 세션 살아 있을 때 flush (이름 확보)
    await this.voiceDailyFlushService.flushDate(guildId, userId, session.date);

    // 3️⃣ 세션 완전 종료
    await this.voiceRedisRepository.deleteSession(guildId, userId);

    // 4️⃣ 임시 채널 삭제 정책
    if (cmd.channelId && (await this.policy.shouldDeleteChannel(guildId, cmd.channelId))) {
      await this.tempChannelStore.removeMember(cmd.channelId, userId);
      await this.tempChannelStore.unregisterTempChannel(guildId, cmd.channelId);
      await this.discord.deleteChannel(cmd.channelId);
    }
    this.logger.debug(`[VOICE LEAVE] ${userId} ${cmd.channelName}`);
  }

  /**
   * ===============================
   * JOIN 후 임시 채널 생성 정책
   * ===============================
   */
  async onUserJoined(cmd: VoiceStateDTO) {
    console.log('onUserJoined');
    await this.handleVoiceStateUpdate(cmd);

    if (this.policy.shouldCreateTempChannel(cmd.channelId)) {
      const tempChannelId = await this.discord.createVoiceChannel({
        guildId: cmd.guildId,
        name: '임시',
        parentCategoryId: cmd.parentCategoryId,
      });

      await this.tempChannelStore.registerTempChannel(cmd.guildId, tempChannelId);
      await this.tempChannelStore.addMember(tempChannelId, cmd.userId);
      await this.discord.moveUserToChannel(cmd.guildId, cmd.userId, tempChannelId);
    }
    this.logger.debug(`[VOICE ENTER] ${cmd.userId} ${cmd.channelName}`);
  }

  async onUserMicToggle(cmd: VoiceStateDTO) {
    await this.handleVoiceStateUpdate(cmd);
  }
}
