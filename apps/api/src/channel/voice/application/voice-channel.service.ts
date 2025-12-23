import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Client, GuildMember } from 'discord.js';
import { VoiceState } from 'discord.js';
import { VoiceChannelPolicy } from './voice-channel.policy';
import { DiscordVoiceGateway } from '../infrastructure/discord-voice.gateway';
import { TempChannelStore } from '../infrastructure/temp-channel-store';
import { VoiceRedisRepository } from '../infrastructure/voice.redis.repository';
import { VoiceStateDTO } from 'src/channel/voice/infrastructure/voice-state.dto';
import { VoiceDailyFlushService } from './voice-daily-flush-service';
import { getKSTDateString, todayYYYYMMDD } from 'src/common/helper';

@Injectable()
export class VoiceChannelService {
  private readonly logger = new Logger(VoiceChannelService.name);
  private readonly channelActions: Record<string, (state: VoiceState) => void>;
  private readonly discord: DiscordVoiceGateway;
  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    @Inject('TempChannelStore') private readonly tempChannelStore: TempChannelStore,
    private readonly policy: VoiceChannelPolicy, // DI
    private readonly voiceRedisRepository: VoiceRedisRepository,
    private readonly voiceDailyFlushService: VoiceDailyFlushService,
  ) {
    this.discord = new DiscordVoiceGateway(this.client);
  }

  async onUserJoined(cmd: VoiceStateDTO) {
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
  }

  async onUserLeave(cmd: VoiceStateDTO) {
    const guildId = cmd.guildId;
    const userId = cmd.userId;
    const now = Date.now();

    const session = await this.voiceRedisRepository.getSession(guildId, userId);
    if (!session) return;

    // 1️⃣ leave 직전까지 누적
    await this.voiceRedisRepository.accumulateDuration(guildId, userId, session, now);

    // ⭐ 날짜 변경 감지 → flush
    //if (session.date !== today) {
    await this.voiceDailyFlushService.flushDate(guildId, userId, session.date);

    // 세션 리셋
    /*
        session = {
      ...session,
      lastUpdatedAt: Date.now(),
      date: today,
    };*/

    //}

    // 2️⃣ 채널 OUT 상태 확정
    session.channelId = null;
    session.alone = false;
    session.lastUpdatedAt = now;

    // 3️⃣ 세션 저장
    await this.voiceRedisRepository.setSession(guildId, userId, session);

    // 4️⃣ 이후 채널 삭제 정책 처리
    if (await this.policy.shouldDeleteChannel(cmd.guildId, cmd.channelId)) {
      await this.tempChannelStore.removeMember(cmd.channelId, cmd.userId);
      await this.tempChannelStore.unregisterTempChannel(cmd.guildId, cmd.channelId);
      await this.discord.deleteChannel(cmd.channelId);
    }
  }

  async onUserMicToggle(cmd: VoiceStateDTO) {
    await this.handleVoiceStateUpdate(cmd);
  }

  async moveUserToChannel(voiceState: VoiceState, channelId: string): Promise<void> {
    try {
      const member: GuildMember | null = voiceState.member;
      if (member && member.voice.channelId) {
        await member.voice.setChannel(channelId); // 유저를 지정한 채널로 이동
        this.logger.log(`Moved ${member.user.tag} to channel ${channelId}`);
      }
    } catch (error) {
      this.logger.error(`Error moving user to channel: ${error.message}`, error);
    }
  }

  async handleVoiceStateUpdate(cmd: VoiceStateDTO) {
    const guildId = cmd.guildId;
    const userId = cmd.userId;

    const today = getKSTDateString();

    const session: VoiceSession = (await this.voiceRedisRepository.getSession(guildId, userId)) ?? {
      channelId: cmd.channelId,
      joinedAt: Date.now(),
      mic: cmd.micOn,
      alone: false,
      lastUpdatedAt: Date.now(),
      date: today,
    };

    // duration 누적
    await this.voiceRedisRepository.accumulateDuration(guildId, userId, session);

    // 세션 갱신
    session.channelId = cmd.channelId ?? session.channelId;
    session.mic = cmd.micOn;
    session.alone = cmd.alone;

    await this.voiceRedisRepository.setSession(guildId, userId, session);
  }
}
