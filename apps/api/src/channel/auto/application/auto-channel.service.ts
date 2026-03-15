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
import { AutoChannelButtonOrm } from '../infrastructure/auto-channel-button.orm-entity';
import { AutoChannelConfigRepository } from '../infrastructure/auto-channel-config.repository';
import { AutoChannelDiscordGateway } from '../infrastructure/auto-channel-discord.gateway';
import { AutoChannelRedisRepository } from '../infrastructure/auto-channel-redis.repository';
import { AutoChannelConfirmedState } from '../infrastructure/auto-channel-state';
import { AutoChannelSubOptionOrm } from '../infrastructure/auto-channel-sub-option.orm-entity';

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
   * F-VOICE-012: 자동방 채널 삭제
   *
   * 채널이 비었을 때 호출된다. 확정방이면 Redis 키 삭제 후 Discord 채널 삭제.
   * 자동방이 아니면 무시한다.
   */
  async handleChannelEmpty(guildId: string, channelId: string): Promise<void> {
    const confirmedState = await this.autoChannelRedis.getConfirmedState(channelId);

    if (confirmedState) {
      await this.deleteConfirmedChannel(channelId, confirmedState);
      return;
    }

    // 자동방이 아니면 무시 (일반 채널)
    void guildId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 단위 B: 버튼 인터랙션 + 확정방 생성 (F-VOICE-009, F-VOICE-010, F-VOICE-011)
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

    const guideChannelId = config.guideChannelId;
    if (!guideChannelId) {
      this.logger.warn(`AutoChannelConfig has no guideChannelId: configId=${configId}`);
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
        guideChannelId,
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
          guideChannelId,
          config.guideMessage,
          config.embedTitle ?? null,
          config.embedColor ?? null,
          buttonPayloads,
        );
      }
    } else {
      messageId = await this.autoChannelDiscordGateway.sendGuideMessage(
        guideChannelId,
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

    // DB 조회 전에 deferReply로 인터랙션 3초 타임아웃 방지
    await interaction.deferReply({ ephemeral: true });

    const button = await this.configRepo.findButtonById(buttonId);

    if (!button?.config) {
      await interaction.editReply({
        content: '설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    // 대기채널 검증: 유저가 등록된 대기채널(트리거 채널)에 있는지 확인
    if (voiceChannelId !== button.config.triggerChannelId) {
      await interaction.editReply({
        content: '대기 채널에서만 선택할 수 있습니다.',
      });
      return;
    }

    if (button.subOptions.length === 0) {
      // 하위 선택지 없음 → 즉시 확정방 생성
      await this.convertToConfirmed(interaction, guildId, userId, member, button);
    } else {
      // 하위 선택지 있음 → Ephemeral로 하위 버튼 표시
      const sorted = [...button.subOptions].sort((a, b) => a.sortOrder - b.sortOrder);
      const rows = this.buildSubOptionActionRows(sorted);

      await interaction.editReply({
        content: '선택지를 고르세요.',
        components: rows,
      });
    }
  }

  /**
   * F-VOICE-011: 2단계 하위 선택지 클릭 처리 → 확정방 생성.
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

    // DB 조회 전에 deferReply로 인터랙션 3초 타임아웃 방지
    await interaction.deferReply({ ephemeral: true });

    const subOption = await this.configRepo.findSubOptionById(subOptionId);

    if (!subOption?.button?.config) {
      await interaction.editReply({
        content: '설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    // 대기채널 검증
    if (voiceChannelId !== subOption.button.config.triggerChannelId) {
      await interaction.editReply({
        content: '대기 채널에서만 선택할 수 있습니다.',
      });
      return;
    }

    await this.convertToConfirmed(
      interaction,
      guildId,
      userId,
      member,
      subOption.button,
      subOption,
    );
  }

  /**
   * F-VOICE-011: 확정방 새로 생성 + 유저 이동 핵심 로직.
   */
  private async convertToConfirmed(
    interaction: ButtonInteraction,
    guildId: string,
    userId: string,
    member: GuildMember,
    button: AutoChannelButtonOrm,
    subOption?: AutoChannelSubOptionOrm,
  ): Promise<void> {
    const userName = member.displayName;

    // 1. 확정방 채널명 결정
    const baseName = this.buildChannelName(userName, button, subOption);

    const finalName = await this.resolveChannelName(guildId, button.targetCategoryId, baseName);

    // 2. 확정방 새로 생성
    const confirmedChannelId = await this.discordVoiceGateway.createVoiceChannel({
      guildId,
      name: finalName,
      parentCategoryId: button.targetCategoryId,
    });

    // 3. 유저를 확정방으로 이동
    await this.discordVoiceGateway.moveUserToChannel(guildId, userId, confirmedChannelId);

    // 4. Redis 확정 상태 저장
    await this.autoChannelRedis.setConfirmedState(confirmedChannelId, {
      guildId,
      userId,
      buttonId: button.id,
      subOptionId: subOption?.id,
    });

    // 5. 세션 추적 시작 (F-VOICE-001과 동일)
    const voiceState = member.voice;
    const micOn = voiceState.selfMute === null ? true : !voiceState.selfMute;
    const channel = voiceState.channel;
    const memberCount = channel ? channel.members.size : 1;
    const alone = memberCount === 1;

    const voiceStateDto = new VoiceStateDto(
      guildId,
      userId,
      confirmedChannelId,
      userName,
      finalName,
      button.targetCategoryId,
      channel?.parent?.name ?? null,
      micOn,
      alone,
      memberCount,
      member.displayAvatarURL({ size: 128 }),
    );

    await this.voiceChannelService.onUserJoined(voiceStateDto);

    // 6. 인터랙션 응답
    await interaction.editReply({ content: `**${finalName}** 방이 생성되었습니다!` });

    this.logger.log(
      `[AUTO CHANNEL] Confirmed: guild=${guildId} user=${userId} channel="${finalName}"`,
    );
  }

  /**
   * 채널명 템플릿 적용.
   *
   * subOption이 있으면 subOption 템플릿을 단독 사용한다.
   *   - {name}: 버튼 기본 이름으로 치환 (opt-in)
   *   - {username}: 유저 닉네임으로 치환
   * subOption이 없으면 버튼 템플릿을 사용한다.
   */
  private buildChannelName(
    userName: string,
    button: AutoChannelButtonOrm,
    subOption?: AutoChannelSubOptionOrm,
  ): string {
    const buttonTemplate = button.channelNameTemplate || `{username}의 ${button.label}`;
    const baseName = buttonTemplate.replace(/{username}/g, userName);

    if (subOption?.channelNameTemplate) {
      return subOption.channelNameTemplate
        .replace(/{name}/g, baseName)
        .replace(/{username}/g, userName);
    }

    return baseName;
  }

  /**
   * 확정방 채널명 중복 해소 (카테고리별 독립 넘버링).
   *
   * 템플릿에 {n}이 포함된 경우:
   *   {n}을 1부터 증가시키며 사용 가능한 이름 반환.
   *   예: "오버워치 #{n}" → "오버워치 #1", "오버워치 #2", ...
   *
   * {n}이 없는 경우 (기존 방식):
   *   중복 시 " 2", " 3", ... 순번 부여.
   *   예: "DHyun의 오버워치" → "DHyun의 오버워치 2"
   */
  private async resolveChannelName(
    guildId: string,
    categoryId: string,
    baseName: string,
  ): Promise<string> {
    const existingNames = await this.autoChannelDiscordGateway.fetchVoiceChannelNamesByCategory(
      guildId,
      categoryId,
    );
    const nameSet = new Set(existingNames);

    if (baseName.includes('{n}')) {
      let index = 1;
      while (nameSet.has(baseName.replace(/{n}/g, String(index)))) {
        index++;
      }
      return baseName.replace(/{n}/g, String(index));
    }

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
    subOptions: AutoChannelSubOptionOrm[],
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

          if (opt.emoji?.trim()) {
            try {
              builder.setEmoji(opt.emoji.trim());
            } catch {
              // 유효하지 않은 이모지 무시
            }
          }

          return builder;
        }),
      );
      rows.push(row);
    }

    return rows;
  }

  /**
   * 확정방 Redis 키 삭제 후 Discord 채널 삭제.
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
}
