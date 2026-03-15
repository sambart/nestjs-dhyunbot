import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getErrorStack } from '../../../common/util/error.util';
import {
  CO_PRESENCE_SESSION_ENDED,
  CoPresenceSessionEndedEvent,
  CoPresenceTickSnapshot,
} from './co-presence.events';
import { CoPresenceDbRepository, UpsertPairDailyRow } from './co-presence-db.repository';

/** 주기적 세션 회전 임계값 (분). 이 값 이상 누적되면 세션을 종료 후 재시작하여 DB에 중간 데이터를 저장한다. */
const FLUSH_THRESHOLD_MINUTES = 5;

interface ActiveCoPresenceSession {
  guildId: string;
  channelId: string;
  userId: string;
  startedAt: Date;
  accumulatedMinutes: number;
  peersSeen: Set<string>;
  peerMinutes: Map<string, number>;
}

@Injectable()
export class CoPresenceService {
  private readonly logger = new Logger(CoPresenceService.name);

  /** key: `${guildId}:${userId}` */
  private readonly activeSessions = new Map<string, ActiveCoPresenceSession>();

  constructor(
    private readonly dbRepo: CoPresenceDbRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 스냅샷을 기반으로 세션을 시작/계속/종료한다.
   * Scheduler가 매 tick마다 호출한다.
   *
   * @param snapshots - 현재 음성 채널 스냅샷 (2명 이상 채널만)
   * @param processedGuildIds - 이번 tick에서 처리된 모든 길드 ID (스냅샷 유무 무관)
   */
  async reconcile(
    snapshots: CoPresenceTickSnapshot[],
    processedGuildIds: string[] = [],
  ): Promise<void> {
    // 스냅샷에서 현재 활성 사용자를 guildId:userId → snapshot info로 매핑
    const currentUsers = new Map<string, { channelId: string; peerIds: string[] }>();

    for (const snapshot of snapshots) {
      for (const userId of snapshot.userIds) {
        const key = `${snapshot.guildId}:${userId}`;
        const peerIds = snapshot.userIds.filter((id) => id !== userId);
        currentUsers.set(key, { channelId: snapshot.channelId, peerIds });
      }
    }

    // 현재 활성 사용자 처리: 시작 또는 계속
    for (const [key, { channelId, peerIds }] of currentUsers) {
      const existing = this.activeSessions.get(key);

      if (existing) {
        if (existing.channelId === channelId) {
          this.continueSession(existing, peerIds);
        } else {
          // 다른 채널로 이동 → 기존 종료 후 새로 시작
          await this.endSession(existing);
          this.activeSessions.delete(key);
          this.startSession(key, channelId, peerIds);
        }
      } else {
        this.startSession(key, channelId, peerIds);
      }
    }

    // 처리된 길드 중 스냅샷에서 사라진 사용자의 세션 종료
    const allProcessedGuildIds = new Set(processedGuildIds);
    const keysToEnd: string[] = [];

    for (const [key, session] of this.activeSessions) {
      // 처리된 길드인데 이 사용자가 현재 스냅샷에 없으면 종료
      if (allProcessedGuildIds.has(session.guildId) && !currentUsers.has(key)) {
        keysToEnd.push(key);
      }
    }

    for (const key of keysToEnd) {
      const session = this.activeSessions.get(key);
      if (session) {
        await this.endSession(session);
        this.activeSessions.delete(key);
      }
    }

    // 주기적 세션 회전: 임계값 이상 누적된 활성 세션을 종료 후 즉시 재시작
    for (const [key, session] of this.activeSessions) {
      if (session.accumulatedMinutes >= FLUSH_THRESHOLD_MINUTES && currentUsers.has(key)) {
        await this.endSession(session);
        const current = currentUsers.get(key)!;
        this.startSession(key, current.channelId, current.peerIds);
      }
    }
  }

  /**
   * 특정 길드의 모든 활성 세션을 강제 종료한다.
   */
  async endAllGuildSessions(guildId: string): Promise<void> {
    const keysToEnd: string[] = [];

    for (const [key, session] of this.activeSessions) {
      if (session.guildId === guildId) {
        keysToEnd.push(key);
      }
    }

    for (const key of keysToEnd) {
      const session = this.activeSessions.get(key);
      if (session) {
        await this.endSession(session);
        this.activeSessions.delete(key);
      }
    }
  }

  /**
   * 모든 활성 세션을 강제 종료한다. (봇 종료 시)
   */
  async endAllSessions(): Promise<void> {
    for (const [key, session] of this.activeSessions) {
      await this.endSession(session);
      this.activeSessions.delete(key);
    }
  }

  private startSession(key: string, channelId: string, peerIds: string[]): void {
    const [guildId, userId] = key.split(':');

    const session: ActiveCoPresenceSession = {
      guildId,
      channelId,
      userId,
      startedAt: new Date(),
      accumulatedMinutes: 1,
      peersSeen: new Set(peerIds),
      peerMinutes: new Map(peerIds.map((id) => [id, 1])),
    };

    this.activeSessions.set(key, session);
    this.logger.debug(
      `[CO-PRESENCE] Session started: guild=${guildId} user=${userId} channel=${channelId} peers=${peerIds.length}`,
    );
  }

  private continueSession(session: ActiveCoPresenceSession, peerIds: string[]): void {
    session.accumulatedMinutes += 1;

    for (const peerId of peerIds) {
      session.peersSeen.add(peerId);
      session.peerMinutes.set(peerId, (session.peerMinutes.get(peerId) ?? 0) + 1);
    }
  }

  private async endSession(session: ActiveCoPresenceSession): Promise<void> {
    const { guildId, channelId, userId, startedAt, accumulatedMinutes, peersSeen, peerMinutes } =
      session;
    const endedAt = new Date();
    const peerIds = [...peersSeen];
    const peerMinutesRecord: Record<string, number> = {};
    for (const [peerId, minutes] of peerMinutes) {
      peerMinutesRecord[peerId] = minutes;
    }

    const date = this.toDateString(endedAt);

    this.logger.debug(
      `[CO-PRESENCE] Session ending: guild=${guildId} user=${userId} duration=${accumulatedMinutes}min peers=${peerIds.length}`,
    );

    try {
      // DB 저장: 세션
      await this.dbRepo.saveSession({
        guildId,
        userId,
        channelId,
        startedAt,
        endedAt,
        durationMin: accumulatedMinutes,
        peerIds,
        peerMinutes: peerMinutesRecord,
      });

      // DB 저장: 일별 집계
      await this.dbRepo.upsertDaily(guildId, userId, date, accumulatedMinutes, 1);

      // DB 저장: 쌍 일별 집계 (양방향 배치 upsert)
      const pairRows: UpsertPairDailyRow[] = [];
      for (const [peerId, minutes] of peerMinutes) {
        pairRows.push({ guildId, userId, peerId, date, minutes, sessionCount: 1 });
        pairRows.push({ guildId, userId: peerId, peerId: userId, date, minutes, sessionCount: 1 });
      }
      await this.dbRepo.upsertPairDailyBatch(pairRows);

      // 이벤트 발행: emitAsync로 모든 핸들러 완료 대기
      const event: CoPresenceSessionEndedEvent = {
        guildId,
        channelId,
        userId,
        startedAt,
        endedAt,
        durationMin: accumulatedMinutes,
        peerIds,
        peerMinutes: peerMinutesRecord,
      };
      await this.eventEmitter.emitAsync(CO_PRESENCE_SESSION_ENDED, event);
    } catch (err) {
      this.logger.error(
        `[CO-PRESENCE] Failed to end session guild=${guildId} user=${userId}`,
        getErrorStack(err),
      );
    }
  }

  /**
   * 현재 시각을 KST 날짜 문자열(YYYY-MM-DD)로 변환한다.
   * date 타입 컬럼에 맞게 ISO 형식 사용.
   */
  private toDateString(date: Date = new Date()): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  }
}
