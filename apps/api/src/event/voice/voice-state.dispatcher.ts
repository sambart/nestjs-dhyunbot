import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VoiceState } from 'discord.js';

import { AutoChannelRedisRepository } from '../../channel/auto/infrastructure/auto-channel-redis.repository';
import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';
import {
  AUTO_CHANNEL_EVENTS,
  AutoChannelChannelEmptyEvent,
  AutoChannelTriggerJoinEvent,
} from '../auto-channel/auto-channel-events';
import { NEWBIE_EVENTS, NewbieVoiceStateChangedEvent } from '../newbie/newbie-events';
import {
  VOICE_EVENTS,
  VoiceAloneChangedEvent,
  VoiceJoinEvent,
  VoiceLeaveEvent,
  VoiceMicToggleEvent,
  VoiceMoveEvent,
} from './voice-events';

@Injectable()
export class VoiceStateDispatcher {
  private readonly logger = new Logger(VoiceStateDispatcher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly autoChannelRedis: AutoChannelRedisRepository,
  ) {}

  @On('voiceStateUpdate')
  async dispatch(oldState: VoiceState, newState: VoiceState) {
    try {
      const isMuteChanged = oldState.selfMute !== newState.selfMute;
      const isJoin = !oldState.channelId && newState.channelId;
      const isLeave = oldState.channelId && !newState.channelId;
      const isMove =
        oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      if (isMove) {
        const oldDto = VoiceStateDto.fromVoiceState(oldState);
        const newDto = VoiceStateDto.fromVoiceState(newState);
        await this.eventEmitter.emitAsync(VOICE_EVENTS.MOVE, new VoiceMoveEvent(oldDto, newDto));
        this.emitAloneChanged(oldState);
        this.emitAloneChanged(newState);

        // 이동 후 이전 채널이 비어있으면 자동방 삭제 이벤트 발행 (fire-and-forget)
        if (oldState.channel && oldState.channel.members.size === 0) {
          this.eventEmitter.emit(
            AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
            new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
          );
        }

        // 모코코 사냥 이벤트 — 이동 후 새 채널 기준 (fire-and-forget)
        if (newState.channelId && newState.channel) {
          const memberIds = [...newState.channel.members.keys()];
          this.eventEmitter.emit(
            NEWBIE_EVENTS.VOICE_STATE_CHANGED,
            new NewbieVoiceStateChangedEvent(
              newState.guild.id,
              newState.channelId,
              oldState.channelId ?? null,
              memberIds,
            ),
          );
        }
      }

      if (isJoin) {
        const isTrigger = await this.autoChannelRedis.isTriggerChannel(
          newState.guild.id,
          newState.channelId!,
        );

        if (isTrigger) {
          const dto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(
            AUTO_CHANNEL_EVENTS.TRIGGER_JOIN,
            new AutoChannelTriggerJoinEvent(dto),
          );
          // 트리거 채널은 세션 추적 제외 — emitAloneChanged 생략
          // 트리거 채널(대기방)은 모코코 사냥 대상 외 — NEWBIE_EVENTS 미발행
        } else {
          const dto = VoiceStateDto.fromVoiceState(newState);
          await this.eventEmitter.emitAsync(VOICE_EVENTS.JOIN, new VoiceJoinEvent(dto));
          this.emitAloneChanged(newState);

          // 모코코 사냥 이벤트 — 입장한 채널 기준 (fire-and-forget)
          if (newState.channelId && newState.channel) {
            const memberIds = [...newState.channel.members.keys()];
            this.eventEmitter.emit(
              NEWBIE_EVENTS.VOICE_STATE_CHANGED,
              new NewbieVoiceStateChangedEvent(
                newState.guild.id,
                newState.channelId,
                null,
                memberIds,
              ),
            );
          }
        }
      }

      if (isLeave) {
        const dto = VoiceStateDto.fromVoiceState(oldState);
        await this.eventEmitter.emitAsync(VOICE_EVENTS.LEAVE, new VoiceLeaveEvent(dto));
        this.emitAloneChanged(oldState);

        // 퇴장 후 채널이 비어있으면 자동방 삭제 이벤트 발행 (fire-and-forget)
        if (oldState.channel && oldState.channel.members.size === 0) {
          this.eventEmitter.emit(
            AUTO_CHANNEL_EVENTS.CHANNEL_EMPTY,
            new AutoChannelChannelEmptyEvent(oldState.guild.id, oldState.channelId!),
          );
        }

        // 모코코 사냥 이벤트 — 퇴장 후 이전 채널 기준 (fire-and-forget)
        // channelId = null(퇴장), channelMemberIds = 퇴장 후 남은 멤버 목록
        if (oldState.channelId && oldState.channel) {
          const memberIds = [...oldState.channel.members.keys()];
          this.eventEmitter.emit(
            NEWBIE_EVENTS.VOICE_STATE_CHANGED,
            new NewbieVoiceStateChangedEvent(
              oldState.guild.id,
              null,
              oldState.channelId,
              memberIds,
            ),
          );
        }
      }

      if (isMuteChanged && !isJoin && !isLeave && !isMove) {
        const dto = VoiceStateDto.fromVoiceState(newState);
        await this.eventEmitter.emitAsync(
          VOICE_EVENTS.MIC_TOGGLE,
          new VoiceMicToggleEvent(dto),
        );
      }
    } catch (error) {
      this.logger.error(
        `[voiceStateUpdate] guild=${newState.guild?.id} user=${newState.member?.id ?? 'unknown'}`,
        (error as Error).stack,
      );
    }
  }

  /** 이벤트 발생 후 해당 채널에 남은 유저들의 alone 상태 변경 이벤트 발행 */
  private emitAloneChanged(state: VoiceState): void {
    if (!state.channel || !state.guild) return;

    const memberIds = [...state.channel.members.keys()];
    if (memberIds.length > 2) return;

    const isAlone = memberIds.length === 1;
    this.eventEmitter.emit(
      VOICE_EVENTS.ALONE_CHANGED,
      new VoiceAloneChangedEvent(state.guild.id, memberIds, isAlone),
    );
  }
}
