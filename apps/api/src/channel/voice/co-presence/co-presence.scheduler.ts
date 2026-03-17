import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getErrorStack } from '../../../common/util/error.util';
import { VoiceExcludedChannelService } from '../application/voice-excluded-channel.service';
import {
  CO_PRESENCE_TICK,
  CoPresenceTickEvent,
  CoPresenceTickSnapshot,
} from './co-presence.events';
import { CoPresenceService } from './co-presence.service';

// TODO(claude 2026-03-17): 음성 채널 멤버 스냅샷은 Bot API 엔드포인트
// GET /bot-api/discord/voice-states 에서 받아오도록 전환 필요.
// 현재는 Gateway 캐시가 없으므로 tick이 빈 스냅샷을 생성한다.

/** 폴링 주기 (밀리초) */
const INTERVAL_MS = 60_000;

@Injectable()
export class CoPresenceScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CoPresenceScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(
    private readonly coPresenceService: CoPresenceService,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onApplicationBootstrap(): void {
    this.intervalId = setInterval(() => void this.tick(), INTERVAL_MS);
    this.logger.log('[CO-PRESENCE SCHEDULER] Started (interval=60s)');
  }

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.coPresenceService.endAllSessions();
    this.logger.log('[CO-PRESENCE SCHEDULER] Stopped (all sessions ended)');
  }

  /**
   * 특정 길드의 모든 활성 세션을 강제 종료한다.
   * MocoResetScheduler가 Redis 키 삭제 전에 호출하여 데이터 정합성을 보장한다.
   */
  async flushGuildSessions(guildId: string): Promise<void> {
    await this.coPresenceService.endAllGuildSessions(guildId);
  }

  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    // TODO(claude 2026-03-17): Bot API 엔드포인트에서 음성 상태를 가져와
    // 스냅샷을 구성해야 함. 현재는 빈 스냅샷으로 reconcile만 수행.
    const allSnapshots: CoPresenceTickSnapshot[] = [];
    const processedGuildIds: string[] = [];

    // 세션 조정 (처리된 모든 길드 ID 전달)
    await this.coPresenceService.reconcile(allSnapshots, processedGuildIds);

    // tick 이벤트 발행 (fire-and-forget)
    if (allSnapshots.length > 0) {
      const tickEvent: CoPresenceTickEvent = { snapshots: allSnapshots };
      this.eventEmitter.emit(CO_PRESENCE_TICK, tickEvent);
    }
  }
}
