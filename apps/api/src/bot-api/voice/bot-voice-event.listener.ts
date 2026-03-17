import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AutoChannelService } from '../../channel/auto/application/auto-channel.service';
import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { VoiceSessionService } from '../../channel/voice/application/voice-session.service';
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';
import { getErrorStack } from '../../common/util/error.util';
import { StatusPrefixResetService } from '../../status-prefix/application/status-prefix-reset.service';

/**
 * Bot → API voice state-update 이벤트를 수신하여 기존 서비스 메서드를 호출한다.
 * 기존 VoiceStateDispatcher + VoiceJoin/Leave/Move/MicToggle/AloneHandler의 로직을 통합.
 */
@Injectable()
export class BotVoiceEventListener {
  private readonly logger = new Logger(BotVoiceEventListener.name);

  constructor(
    private readonly voiceChannelService: VoiceChannelService,
    private readonly voiceSessionService: VoiceSessionService,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    private readonly statusPrefixResetService: StatusPrefixResetService,
    private readonly autoChannelService: AutoChannelService,
  ) {}

  @OnEvent('bot-api.voice.state-update')
  async handle(dto: VoiceStateUpdateEventDto): Promise<void> {
    try {
      switch (dto.eventType) {
        case 'join':
          await this.handleJoin(dto);
          break;
        case 'leave':
          await this.handleLeave(dto);
          break;
        case 'move':
          await this.handleMove(dto);
          break;
        case 'mic_toggle':
          await this.handleMicToggle(dto);
          break;
      }
    } catch (err) {
      this.logger.error(
        `[BOT-API VOICE] ${dto.eventType} failed: guild=${dto.guildId} user=${dto.userId}`,
        getErrorStack(err),
      );
    }
  }

  private async handleJoin(dto: VoiceStateUpdateEventDto): Promise<void> {
    if (!dto.channelId) return;

    const isExcluded = await this.excludedChannelService.isExcludedChannel(
      dto.guildId,
      dto.channelId,
      dto.parentCategoryId,
    );
    if (isExcluded) return;

    const state = this.buildStateDto(dto, false);
    await this.voiceChannelService.onUserJoined(state);

    // alone 상태 갱신
    this.emitAloneChanged(dto.guildId, dto.channelMemberIds);
  }

  private async handleLeave(dto: VoiceStateUpdateEventDto): Promise<void> {
    if (!dto.oldChannelId) return;

    const isExcluded = await this.excludedChannelService.isExcludedChannel(
      dto.guildId,
      dto.oldChannelId,
      dto.oldParentCategoryId,
    );
    if (isExcluded) return;

    const state = this.buildStateDto(dto, true);
    await this.voiceChannelService.onUserLeave(state);

    // Status Prefix 닉네임 자동 복원 (fire-and-forget)
    this.statusPrefixResetService
      .restoreOnLeave(dto.guildId, dto.userId)
      .catch((err) =>
        this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', getErrorStack(err)),
      );

    // alone 상태 갱신 (이전 채널 기준)
    this.emitAloneChanged(dto.guildId, dto.oldChannelMemberIds);

    // 빈 채널 감지 → 자동방 삭제 (fire-and-forget)
    if (dto.oldChannelMemberCount === 0) {
      this.autoChannelService
        .handleChannelEmpty(dto.guildId, dto.oldChannelId)
        .catch((err) =>
          this.logger.error('[AUTO_CHANNEL] handleChannelEmpty failed', getErrorStack(err)),
        );
    }
  }

  private async handleMove(dto: VoiceStateUpdateEventDto): Promise<void> {
    if (!dto.oldChannelId || !dto.channelId) return;

    const oldExcluded = await this.excludedChannelService.isExcludedChannel(
      dto.guildId,
      dto.oldChannelId,
      dto.oldParentCategoryId,
    );
    const newExcluded = await this.excludedChannelService.isExcludedChannel(
      dto.guildId,
      dto.channelId,
      dto.parentCategoryId,
    );

    if (!oldExcluded && !newExcluded) {
      // 둘 다 일반 채널 — MOVE
      const oldState = this.buildStateDto(dto, true);
      const newState = this.buildStateDto(dto, false);
      await this.voiceChannelService.onUserMove(oldState, newState);
    } else if (oldExcluded && !newExcluded) {
      // 제외 → 일반 — JOIN만
      const state = this.buildStateDto(dto, false);
      await this.voiceChannelService.onUserJoined(state);
    } else if (!oldExcluded && newExcluded) {
      // 일반 → 제외 — LEAVE만
      const state = this.buildStateDto(dto, true);
      await this.voiceChannelService.onUserLeave(state);

      this.statusPrefixResetService
        .restoreOnLeave(dto.guildId, dto.userId)
        .catch((err) =>
          this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', getErrorStack(err)),
        );
    }
    // 둘 다 제외 — 무시

    // alone 상태 갱신 (양쪽 채널)
    this.emitAloneChanged(dto.guildId, dto.oldChannelMemberIds);
    this.emitAloneChanged(dto.guildId, dto.channelMemberIds);

    // 이전 채널이 비어있으면 자동방 삭제 (fire-and-forget)
    if (dto.oldChannelMemberCount === 0) {
      this.autoChannelService
        .handleChannelEmpty(dto.guildId, dto.oldChannelId)
        .catch((err) =>
          this.logger.error('[AUTO_CHANNEL] handleChannelEmpty failed', getErrorStack(err)),
        );
    }
  }

  private async handleMicToggle(dto: VoiceStateUpdateEventDto): Promise<void> {
    if (!dto.channelId) return;

    const isExcluded = await this.excludedChannelService.isExcludedChannel(
      dto.guildId,
      dto.channelId,
      dto.parentCategoryId,
    );
    if (isExcluded) return;

    const state = this.buildStateDto(dto, false);
    await this.voiceChannelService.onUserMicToggle(state);
  }

  /** 채널 멤버 2명 이하일 때 alone 상태 갱신 */
  private emitAloneChanged(guildId: string, memberIds: string[]): void {
    if (memberIds.length > 2) return;
    const isAlone = memberIds.length === 1;

    this.voiceSessionService
      .updateAloneForChannel(guildId, memberIds, isAlone)
      .catch((err) =>
        this.logger.error('[VOICE] updateAloneForChannel failed', getErrorStack(err)),
      );
  }

  /** DTO로부터 VoiceStateDto 구성 */
  private buildStateDto(dto: VoiceStateUpdateEventDto, useOld: boolean): VoiceStateDto {
    return new VoiceStateDto(
      dto.guildId,
      dto.userId,
      useOld ? dto.oldChannelId! : dto.channelId!,
      dto.userName,
      useOld ? (dto.oldChannelName ?? '') : (dto.channelName ?? ''),
      useOld ? dto.oldParentCategoryId : dto.parentCategoryId,
      useOld ? dto.oldCategoryName : dto.categoryName,
      dto.micOn,
      (useOld ? dto.oldChannelMemberCount : dto.channelMemberCount) === 1,
      useOld ? dto.oldChannelMemberCount : dto.channelMemberCount,
      dto.avatarUrl,
    );
  }
}

/** 리스너에서 사용하는 DTO 타입 (bot-api-client의 VoiceStateUpdateDto와 동일 구조) */
interface VoiceStateUpdateEventDto {
  guildId: string;
  userId: string;
  channelId: string | null;
  oldChannelId: string | null;
  eventType: 'join' | 'leave' | 'move' | 'mic_toggle';
  userName: string;
  channelName: string | null;
  oldChannelName: string | null;
  parentCategoryId: string | null;
  categoryName: string | null;
  oldParentCategoryId: string | null;
  oldCategoryName: string | null;
  micOn: boolean;
  avatarUrl: string | null;
  channelMemberCount: number;
  oldChannelMemberCount: number;
  channelMemberIds: string[];
  oldChannelMemberIds: string[];
}
