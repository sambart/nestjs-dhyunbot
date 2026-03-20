import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { VoiceGameService } from '../../channel/voice/application/voice-game.service';
import {
  CO_PRESENCE_TICK,
  CoPresenceTickEvent,
  CoPresenceTickSnapshot,
} from '../../channel/voice/co-presence/co-presence.events';
import { CoPresenceService } from '../../channel/voice/co-presence/co-presence.service';
import { BotApiAuthGuard } from '../bot-api-auth.guard';

/**
 * Bot → API 동시접속 스냅샷 수신 엔드포인트.
 * Bot이 60초마다 수집한 음성 채널 멤버 스냅샷을 수신하여 CoPresenceService로 처리한다.
 */
@Controller('bot-api/co-presence')
@UseGuards(BotApiAuthGuard)
export class BotCoPresenceController {
  private readonly logger = new Logger(BotCoPresenceController.name);

  constructor(
    private readonly coPresenceService: CoPresenceService,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    private readonly eventEmitter: EventEmitter2,
    private readonly voiceGameService: VoiceGameService,
  ) {}

  @Post('snapshots')
  @HttpCode(HttpStatus.OK)
  async receiveSnapshots(
    @Body() body: { snapshots: CoPresenceTickSnapshot[] },
  ): Promise<{ ok: boolean }> {
    // 제외 채널 필터링
    const filtered: CoPresenceTickSnapshot[] = [];
    for (const snapshot of body.snapshots) {
      const isExcluded = await this.excludedChannelService.isExcludedChannel(
        snapshot.guildId,
        snapshot.channelId,
        null,
      );
      if (!isExcluded) {
        filtered.push(snapshot);
      }
    }

    // 처리된 길드 ID 수집 (스냅샷 유무 무관, 모든 길드 대상)
    const processedGuildIds = [...new Set(body.snapshots.map((s) => s.guildId))];

    // Phase 2: 게임 세션 갱신 (제외 채널 필터링 후)
    for (const snapshot of filtered) {
      if (snapshot.memberActivities && snapshot.memberActivities.length > 0) {
        await this.voiceGameService.reconcileForChannel(
          snapshot.guildId,
          snapshot.channelId,
          snapshot.memberActivities,
        );
      }
    }

    // 기존 CoPresenceService로 세션 조정
    await this.coPresenceService.reconcile(filtered, processedGuildIds);

    // tick 이벤트 발행
    if (filtered.length > 0) {
      const tickEvent: CoPresenceTickEvent = { snapshots: filtered };
      this.eventEmitter.emit(CO_PRESENCE_TICK, tickEvent);
    }

    this.logger.debug(
      `[BOT-API] co-presence snapshots: total=${body.snapshots.length} filtered=${filtered.length} guilds=${processedGuildIds.length}`,
    );

    return { ok: true };
  }

  @Post('flush')
  @HttpCode(HttpStatus.OK)
  async flush(): Promise<{ ok: boolean }> {
    await this.coPresenceService.endAllSessions();
    this.logger.log('[BOT-API] co-presence flush completed');
    return { ok: true };
  }
}
