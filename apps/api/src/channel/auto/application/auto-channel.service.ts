import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  GuildMember,
} from 'discord.js';

import { VoiceChannelService } from '../../voice/application/voice-channel.service';
import { DiscordVoiceGateway } from '../../voice/infrastructure/discord-voice.gateway';
import { VoiceStateDto } from '../../voice/infrastructure/voice-state.dto';
import { AutoChannelButton } from '../domain/auto-channel-button.entity';
import { AutoChannelConfig } from '../domain/auto-channel-config.entity';
import { AutoChannelSubOption } from '../domain/auto-channel-sub-option.entity';
import { AutoChannelConfigRepository } from '../infrastructure/auto-channel-config.repository';
import { AutoChannelDiscordGateway } from '../infrastructure/auto-channel-discord.gateway';
import { AutoChannelRedisRepository } from '../infrastructure/auto-channel-redis.repository';
import { AutoChannelConfirmedState, AutoChannelWaitingState } from '../infrastructure/auto-channel-state';

/** Discord 버튼 제약: ActionRow당 최대 버튼 수 */
const BUTTONS_PER_ROW = 5;

/** 하위 선택지 버튼 customId 접두사 */
const CUSTOM_ID_SUB_OPTION_PREFIX = 'auto_sub:';

@Injectable()
export class AutoChannelService {
  private readonly logger = new Logger(AutoChannelService.name);

  constructor(
    private readonly configRepo: AutoChannelConfigRepository,
    private readonly autoChannelRedis: AutoChannelRedisRepository,
    private readonly discordVoiceGateway: DiscordVoiceGateway,
    private readonly autoChannelDiscordGateway: AutoChannelDiscordGateway,
    private readonly voiceChannelService: VoiceChannelService,
  ) {}

  /**
   * F-VOICE-007 + F-VOICE-008
   * 트리거 채널 입장 이벤트 수신 시 대기방을 생성하고 유저를 이동시킨다.
   */
  async handleTriggerJoin(state: VoiceStateDto): Promise<void> {
    const config = await this.findConfig(state.guildId, state.channelId);
    if (!config) {
      // 설정이 없는 경우 — Redis 트리거 Set이 stale할 수 있음. 무시.
      this.logger.warn(
        `[AUTO CHANNEL] Config not found: guild=${state.guildId} trigger=${state.channelId}`,
      );
      return;
    }

    const channelName = this.applyTemplate(config.waitingRoomTemplate, state.userName);

    // 1. Discord API로 대기방 음성 채널 생성 (트리거 채널과 동일한 카테고리)
    const waitingChannelId = await this.discordVoiceGateway.createVoiceChannel({
      guildId: state.guildId,
      name: channelName,
      parentCategoryId: state.parentCategoryId ?? undefined,
    });

    // 2. Redis에 대기방 상태 저장 (TTL 12h)
    await this.autoChannelRedis.setWaitingState(waitingChannelId, {
      guildId: state.guildId,
      userId: state.userId,
      triggerChannelId: state.channelId,
      configId: config.id,
    });

    // 3. 유저를 대기방으로 이동 (실패 시 warn 로그 후 계속 — 고아 채널은 TTL로 정리)
    try {
      await this.discordVoiceGateway.moveUserToChannel(
        state.guildId,
        state.userId,
        waitingChannelId,
      );
    } catch (err) {
      this.logger.warn(
        `[AUTO CHANNEL] Failed to move user to waiting room: guild=${state.guildId} user=${state.userId} waitingChannel=${waitingChannelId}`,
        (err as Error).stack,
      );
      // 채널은 이미 생성됨 — TTL 만료 또는 단위 C의 빈 채널 삭제로 정리됨
    }

    this.logger.log(
      `[AUTO CHANNEL] Waiting room created: guild=${state.guildId} user=${state.userId} channel=${waitingChannelId}`,
    );
  }

  /**
   * F-VOICE-012: 자동방 채널 삭제
   *
   * 채널이 비었을 때 호출된다. 대기방 또는 확정방이면 Redis 키 삭제 후 Discord 채널 삭제.
   * 자동방이 아니면 무시한다.
   *
   * VOICE_EVENTS.LEAVE가 await emitAsync로 완료된 후 CHANNEL_EMPTY가 emit(fire-and-forget)으로
   * 발행되므로, 마지막 퇴장자의 세션은 이미 종료된 상태이다.
   */
  async handleChannelEmpty(guildId: string, channelId: string): Promise<void> {
    // 1단계: 대기방 여부 확인
    const waitingState = await this.autoChannelRedis.getWaitingState(channelId);

    if (waitingState) {
      await this.deleteWaitingChannel(channelId, waitingState);
      return;
    }

    // 2단계: 확정방 여부 확인
    const confirmedState = await this.autoChannelRedis.getConfirmedState(channelId);

    if (confirmedState) {
      await this.deleteConfirmedChannel(channelId, confirmedState);
      return;
    }

    // 자동방이 아니면 무시 (일반 채널)
    void guildId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 단위 B: 버튼 인터랙션 + 확정방 전환 (F-VOICE-009, F-VOICE-010, F-VOICE-011)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * F-VOICE-009: 안내 메시지 전송 또는 갱신.
   * 웹 설정 저장 후 또는 봇 기동 시 호출.
   */
  async sendOrUpdateGuideMessage(configId: number): Promise<void> {
    const config = await this.configRepo.findById(configId);
    if (!config) {
      this.logger.warn(`AutoChannelConfig not found: configId=${configId}`);
      return;
    }

    const buttonPayloads = config.buttons.map((btn) => ({
      id: btn.id,
      label: btn.label,
      emoji: btn.emoji,
    }));

    let messageId: string;

    if (config.guideMessageId) {
      const editResult = await this.autoChannelDiscordGateway.editGuideMessage(
        config.triggerChannelId,
        config.guideMessageId,
        config.guideMessage,
        config.embedTitle ?? null,
        config.embedColor ?? null,
        buttonPayloads,
      );

      if (editResult !== null) {
        messageId = editResult;
      } else {
        messageId = await this.autoChannelDiscordGateway.sendGuideMessage(
          config.triggerChannelId,
          config.guideMessage,
          config.embedTitle ?? null,
          config.embedColor ?? null,
          buttonPayloads,
        );
      }
    } else {
      messageId = await this.autoChannelDiscordGateway.sendGuideMessage(
        config.triggerChannelId,
        config.guideMessage,
        config.embedTitle ?? null,
        config.embedColor ?? null,
        buttonPayloads,
      );
    }

    await this.configRepo.updateGuideMessageId(configId, messageId);
    this.logger.log(`Guide message updated: configId=${configId}, messageId=${messageId}`);
  }

  /**
   * F-VOICE-010 / F-VOICE-011: 1단계 버튼 클릭 처리.
   * - 하위 선택지 없음 → convertToConfirmed 직접 호출 (F-VOICE-011)
   * - 하위 선택지 있음 → Ephemeral 메시지로 하위 버튼 표시 (F-VOICE-010)
   */
  async handleButtonClick(interaction: ButtonInteraction): Promise<void> {
    const buttonId = parseInt(interaction.customId.split(':')[1], 10);
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        ephemeral: true,
        content: '이 기능은 서버에서만 사용할 수 있습니다.',
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannelId = member.voice.channelId;

    if (!voiceChannelId) {
      await interaction.reply({
        ephemeral: true,
        content: '음성 채널에 입장한 후 클릭하세요.',
      });
      return;
    }

    const waitingState = await this.autoChannelRedis.getWaitingState(voiceChannelId);

    if (!waitingState) {
      await interaction.reply({
        ephemeral: true,
        content: '대기방에서만 선택할 수 있습니다.',
      });
      return;
    }

    if (waitingState.userId !== userId) {
      await interaction.reply({
        ephemeral: true,
        content: '본인의 대기방에서만 선택할 수 있습니다.',
      });
      return;
    }

    const button = await this.configRepo.findButtonById(buttonId);

    if (!button) {
      await interaction.reply({
        ephemeral: true,
        content: '설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    if (button.subOptions.length === 0) {
      // 하위 선택지 없음 → 즉시 확정방 전환
      await interaction.deferReply({ ephemeral: true });
      await this.convertToConfirmed(interaction, voiceChannelId, waitingState, button);
    } else {
      // 하위 선택지 있음 → Ephemeral로 하위 버튼 표시
      const sorted = [...button.subOptions].sort((a, b) => a.sortOrder - b.sortOrder);
      const rows = this.buildSubOptionActionRows(sorted);

      await interaction.reply({
        ephemeral: true,
        content: '선택지를 고르세요.',
        components: rows,
      });
    }
  }

  /**
   * F-VOICE-011: 2단계 하위 선택지 클릭 처리 → 확정방 전환.
   */
  async handleSubOptionClick(interaction: ButtonInteraction): Promise<void> {
    const subOptionId = parseInt(interaction.customId.split(':')[1], 10);
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        ephemeral: true,
        content: '이 기능은 서버에서만 사용할 수 있습니다.',
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannelId = member.voice.channelId;

    if (!voiceChannelId) {
      await interaction.reply({
        ephemeral: true,
        content: '음성 채널에 입장한 후 클릭하세요.',
      });
      return;
    }

    const waitingState = await this.autoChannelRedis.getWaitingState(voiceChannelId);

    if (!waitingState) {
      await interaction.reply({
        ephemeral: true,
        content: '대기방에서만 선택할 수 있습니다.',
      });
      return;
    }

    if (waitingState.userId !== userId) {
      await interaction.reply({
        ephemeral: true,
        content: '본인의 대기방에서만 선택할 수 있습니다.',
      });
      return;
    }

    const subOption = await this.configRepo.findSubOptionById(subOptionId);

    if (!subOption) {
      await interaction.reply({
        ephemeral: true,
        content: '설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await this.convertToConfirmed(
      interaction,
      voiceChannelId,
      waitingState,
      subOption.button,
      subOption,
    );
  }

  /**
   * F-VOICE-011: 대기방 → 확정방 전환 핵심 로직.
   */
  private async convertToConfirmed(
    interaction: ButtonInteraction,
    waitingChannelId: string,
    waitingState: AutoChannelWaitingState,
    button: AutoChannelButton,
    subOption?: AutoChannelSubOption,
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    const userName = member.displayName;
    const guildId = waitingState.guildId;

    // 1. 확정방 채널명 결정
    const baseName = subOption
      ? `${userName}의 ${button.label} ${subOption.channelSuffix}`
      : `${userName}의 ${button.label}`;

    const finalName = await this.resolveChannelName(guildId, baseName);

    // 2. Discord 채널 수정 (대기방 → 확정방 변환)
    await this.autoChannelDiscordGateway.editVoiceChannel(
      waitingChannelId,
      finalName,
      button.targetCategoryId,
    );

    // 3. Redis 상태 전환
    await this.autoChannelRedis.deleteWaitingState(waitingChannelId);
    await this.autoChannelRedis.setConfirmedState(waitingChannelId, {
      guildId: waitingState.guildId,
      userId: waitingState.userId,
      buttonId: button.id,
      subOptionId: subOption?.id,
    });

    // 4. 세션 추적 시작 (F-VOICE-001과 동일)
    const voiceState = member.voice;
    const micOn = voiceState.selfMute === null ? true : !voiceState.selfMute;
    const channel = voiceState.channel;
    const memberCount = channel ? channel.members.size : 1;
    const alone = memberCount === 1;

    const voiceStateDto = new VoiceStateDto(
      waitingState.guildId,
      waitingState.userId,
      waitingChannelId,
      userName,
      finalName,
      button.targetCategoryId,
      micOn,
      alone,
      memberCount,
    );

    await this.voiceChannelService.onUserJoined(voiceStateDto);

    // 5. 인터랙션 응답
    const successContent = `**${finalName}** 방이 생성되었습니다!`;

    if (interaction.deferred) {
      await interaction.editReply({ content: successContent });
    } else {
      await interaction.reply({ ephemeral: true, content: successContent });
    }

    this.logger.log(
      `[AUTO CHANNEL] Confirmed: guild=${guildId} user=${waitingState.userId} channel="${finalName}"`,
    );
  }

  /**
   * 확정방 채널명 중복 시 순번 부여.
   * 예: "DHyun의 오버워치" → "DHyun의 오버워치 2"
   */
  private async resolveChannelName(guildId: string, baseName: string): Promise<string> {
    const existingNames = await this.autoChannelDiscordGateway.fetchGuildVoiceChannelNames(guildId);
    const nameSet = new Set(existingNames);

    if (!nameSet.has(baseName)) {
      return baseName;
    }

    let index = 2;
    while (nameSet.has(`${baseName} ${index}`)) {
      index++;
    }

    return `${baseName} ${index}`;
  }

  /**
   * 하위 선택지 목록을 Discord ActionRow 컴포넌트 배열로 변환.
   * customId 형식: auto_sub:{subOptionId}
   */
  private buildSubOptionActionRows(
    subOptions: AutoChannelSubOption[],
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < subOptions.length; i += BUTTONS_PER_ROW) {
      const rowOptions = subOptions.slice(i, i + BUTTONS_PER_ROW);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        rowOptions.map((opt) => {
          const builder = new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID_SUB_OPTION_PREFIX}${opt.id}`)
            .setLabel(opt.label)
            .setStyle(ButtonStyle.Primary);

          if (opt.emoji) {
            builder.setEmoji(opt.emoji);
          }

          return builder;
        }),
      );
      rows.push(row);
    }

    return rows;
  }

  /**
   * 대기방 Redis 키 삭제 후 Discord 채널 삭제.
   * 대기방은 세션 추적 대상이 아니므로 Redis 키 삭제 + Discord 채널 삭제만 수행한다.
   */
  private async deleteWaitingChannel(
    channelId: string,
    state: AutoChannelWaitingState,
  ): Promise<void> {
    await this.autoChannelRedis.deleteWaitingState(channelId);

    try {
      await this.discordVoiceGateway.deleteChannel(channelId);
      this.logger.log(
        `[AUTO CHANNEL] Waiting channel deleted: ${channelId} (guild=${state.guildId})`,
      );
    } catch (error) {
      this.logger.error(
        `[AUTO CHANNEL] Failed to delete waiting channel: ${channelId}`,
        (error as Error).stack,
      );
      // Discord 채널 삭제 실패 시 Redis 키는 이미 삭제된 상태.
      // 고아 채널은 수동 정리 필요.
    }
  }

  /**
   * 확정방 Redis 키 삭제 후 Discord 채널 삭제.
   * VOICE_EVENTS.LEAVE await emitAsync 완료 후 CHANNEL_EMPTY 발행 → 별도 세션 종료 불필요.
   */
  private async deleteConfirmedChannel(
    channelId: string,
    state: AutoChannelConfirmedState,
  ): Promise<void> {
    await this.autoChannelRedis.deleteConfirmedState(channelId);

    try {
      await this.discordVoiceGateway.deleteChannel(channelId);
      this.logger.log(
        `[AUTO CHANNEL] Confirmed channel deleted: ${channelId} (guild=${state.guildId})`,
      );
    } catch (error) {
      this.logger.error(
        `[AUTO CHANNEL] Failed to delete confirmed channel: ${channelId}`,
        (error as Error).stack,
      );
    }
  }

  /** waitingRoomTemplate의 {username} 변수 치환 */
  private applyTemplate(template: string, username: string): string {
    return template.replace('{username}', username);
  }

  /** 트리거 채널 설정 조회 (DB) */
  private async findConfig(
    guildId: string,
    triggerChannelId: string,
  ): Promise<AutoChannelConfig | null> {
    return this.configRepo.findByTriggerChannel(guildId, triggerChannelId);
  }
}
