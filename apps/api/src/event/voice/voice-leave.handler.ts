import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { VoiceChannelService } from '../../channel/voice/application/voice-channel.service';
import { getErrorStack } from '../../common/util/error.util';
import { StatusPrefixResetService } from '../../status-prefix/application/status-prefix-reset.service';
import { VOICE_EVENTS, VoiceLeaveEvent } from './voice-events';

@Injectable()
export class VoiceLeaveHandler {
  private readonly logger = new Logger(VoiceLeaveHandler.name);

  constructor(
    private readonly voiceChannelService: VoiceChannelService,
    private readonly statusPrefixResetService: StatusPrefixResetService,
  ) {}

  @OnEvent(VOICE_EVENTS.LEAVE)
  async handle(event: VoiceLeaveEvent) {
    await this.voiceChannelService.onUserLeave(event.state);

    // Status Prefix 닉네임 자동 복원 (F-STATUS-PREFIX-005, fire-and-forget)
    // 오류 시 로그 기록 후 조용히 실패 — voice 도메인 처리에 영향 없음
    this.statusPrefixResetService
      .restoreOnLeave(event.state.guildId, event.state.userId)
      .catch((err) =>
        this.logger.error('[STATUS_PREFIX] restoreOnLeave failed', getErrorStack(err)),
      );
  }
}
