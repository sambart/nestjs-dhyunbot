import { getKSTDateString } from '@dhyunbot/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ActivityType, type GuildMember } from 'discord.js';

import { getErrorStack } from '../../../common/util/error.util';
import { VoiceGameDbRepository } from '../infrastructure/voice-game-db.repository';
import { VoiceGameRedisRepository } from '../infrastructure/voice-game-redis.repository';
import { type VoiceGameSession } from '../infrastructure/voice-game-session';

@Injectable()
export class VoiceGameService {
  private readonly logger = new Logger(VoiceGameService.name);

  constructor(
    private readonly redisRepo: VoiceGameRedisRepository,
    private readonly dbRepo: VoiceGameDbRepository,
  ) {}

  /**
   * 음성 입장 시 게임 세션 시작 (F-VOICE-028).
   * 입장 시점에 이미 게임 중이면 즉시 Redis에 세션 저장.
   */
  async onUserJoined(
    guildId: string,
    userId: string,
    channelId: string,
    member: GuildMember,
  ): Promise<void> {
    try {
      const activity = this.extractPlayingActivity(member);
      if (!activity) return;

      const session: VoiceGameSession = {
        gameName: activity.gameName,
        applicationId: activity.applicationId,
        startedAt: Date.now(),
        channelId,
      };

      await this.redisRepo.setGameSession(guildId, userId, session);
    } catch (error) {
      this.logger.error(
        `[VOICE GAME] onUserJoined 오류 guild=${guildId} user=${userId}`,
        getErrorStack(error),
      );
    }
  }

  /**
   * CoPresenceScheduler 틱에서 호출. 음성 채널 멤버들의 게임 상태를 갱신한다 (F-VOICE-029).
   * 제외 채널 필터링 이후, humanMembers.length < 2 체크 이전에 호출되어야 함.
   */
  async reconcileForChannel(
    guildId: string,
    channelId: string,
    members: GuildMember[],
  ): Promise<void> {
    for (const member of members) {
      try {
        await this.reconcileMember(guildId, channelId, member);
      } catch (error) {
        this.logger.error(
          `[VOICE GAME] reconcileForChannel 오류 guild=${guildId} channel=${channelId} user=${member.id}`,
          getErrorStack(error),
        );
      }
    }
  }

  /**
   * 음성 퇴장 시 게임 세션 종료 (F-VOICE-030).
   */
  async onUserLeft(guildId: string, userId: string): Promise<void> {
    try {
      const session = await this.redisRepo.getGameSession(guildId, userId);
      if (session) {
        await this.endSession(guildId, userId, session);
      }
    } catch (error) {
      this.logger.error(
        `[VOICE GAME] onUserLeft 오류 guild=${guildId} user=${userId}`,
        getErrorStack(error),
      );
    }
  }

  /**
   * 봇 종료 시 모든 게임 세션 일괄 종료.
   * Redis SCAN으로 voice:game:session:* 패턴의 모든 키를 순회하여 endSession 호출.
   */
  async endAllSessions(): Promise<void> {
    try {
      const keys = await this.redisRepo.scanAllSessionKeys();
      await Promise.all(keys.map((key) => this.endSessionByKey(key)));
    } catch (error) {
      this.logger.error('[VOICE GAME] endAllSessions 오류', getErrorStack(error));
    }
  }

  /**
   * Redis 키 하나에 해당하는 게임 세션을 종료한다.
   * endAllSessions의 각 키 처리를 위임받아 중첩 깊이를 줄인다.
   */
  private async endSessionByKey(key: string): Promise<void> {
    try {
      const parsed = this.parseSessionKey(key);
      if (!parsed) return;

      const session = await this.redisRepo.getGameSession(parsed.guildId, parsed.userId);
      if (session) {
        await this.endSession(parsed.guildId, parsed.userId, session);
      }
    } catch (error) {
      this.logger.error(
        `[VOICE GAME] endAllSessions 개별 키 처리 오류 key=${key}`,
        getErrorStack(error),
      );
    }
  }

  /**
   * 게임 세션 종료: DB에 activity INSERT + daily UPSERT 후 Redis 키 삭제 (F-VOICE-031).
   * durationMin < 1이면 DB 저장 없이 Redis 키만 삭제.
   */
  async endSession(guildId: string, userId: string, session: VoiceGameSession): Promise<void> {
    const now = Date.now();
    const durationMin = Math.floor((now - session.startedAt) / 60_000);

    if (durationMin >= 1) {
      const startedAt = new Date(session.startedAt);
      const endedAt = new Date(now);

      // KST 기준 날짜 YYYY-MM-DD
      const kstYYYYMMDD = getKSTDateString();
      const date = `${kstYYYYMMDD.slice(0, 4)}-${kstYYYYMMDD.slice(4, 6)}-${kstYYYYMMDD.slice(6, 8)}`;

      await this.dbRepo.saveActivity({
        guildId,
        userId,
        channelId: session.channelId,
        gameName: session.gameName,
        applicationId: session.applicationId,
        startedAt,
        endedAt,
        durationMin,
      });

      await this.dbRepo.upsertDaily(guildId, userId, session.gameName, date, durationMin);
    }

    await this.redisRepo.deleteGameSession(guildId, userId);
  }

  /**
   * member.presence.activities에서 ActivityType.Playing 타입 활동을 추출한다.
   */
  private extractPlayingActivity(
    member: GuildMember,
  ): { gameName: string; applicationId: string | null } | null {
    const activities = member.presence?.activities;
    if (!activities) return null;

    const playingActivity = activities.find((a) => a.type === ActivityType.Playing);
    if (!playingActivity) return null;

    return {
      gameName: playingActivity.name,
      applicationId: playingActivity.applicationId ?? null,
    };
  }

  /**
   * 단일 멤버에 대해 게임 상태를 확인하고 세션을 갱신한다.
   */
  private async reconcileMember(
    guildId: string,
    channelId: string,
    member: GuildMember,
  ): Promise<void> {
    const currentActivity = this.extractPlayingActivity(member);
    const currentSession = await this.redisRepo.getGameSession(guildId, member.id);

    const hasCurrentGame = currentActivity !== null;
    const hasActiveSession = currentSession !== null;

    if (!hasCurrentGame && !hasActiveSession) {
      // 게임 없음 + 세션 없음: 스킵
      return;
    }

    if (hasCurrentGame && !hasActiveSession) {
      // 게임 있음 + 세션 없음: 새 게임 시작
      const newSession: VoiceGameSession = {
        gameName: currentActivity.gameName,
        applicationId: currentActivity.applicationId,
        startedAt: Date.now(),
        channelId,
      };
      await this.redisRepo.setGameSession(guildId, member.id, newSession);
      return;
    }

    if (!hasCurrentGame && hasActiveSession) {
      // 게임 없음 + 세션 있음: 게임 종료
      await this.endSession(guildId, member.id, currentSession);
      return;
    }

    // 게임 있음 + 세션 있음: 같은 게임인지 다른 게임인지 판정
    if (hasCurrentGame && hasActiveSession) {
      const isSameGame = this.isSameGame(currentActivity, currentSession);

      if (isSameGame) {
        // 같은 게임 계속: 스킵
        return;
      }

      // 다른 게임으로 전환: 이전 세션 종료 후 새 세션 시작
      await this.endSession(guildId, member.id, currentSession);

      const newSession: VoiceGameSession = {
        gameName: currentActivity.gameName,
        applicationId: currentActivity.applicationId,
        startedAt: Date.now(),
        channelId,
      };
      await this.redisRepo.setGameSession(guildId, member.id, newSession);
    }
  }

  /**
   * 게임 동일성 판정.
   * applicationId가 둘 다 존재하면 applicationId 비교, 하나라도 null이면 gameName 비교.
   */
  private isSameGame(
    current: { gameName: string; applicationId: string | null },
    session: VoiceGameSession,
  ): boolean {
    if (current.applicationId !== null && session.applicationId !== null) {
      return current.applicationId === session.applicationId;
    }
    return current.gameName === session.gameName;
  }

  /**
   * Redis 키에서 guildId, userId를 파싱한다.
   * 키 형식: voice:game:session:{guildId}:{userId}
   */
  private parseSessionKey(key: string): { guildId: string; userId: string } | null {
    // VoiceGameKeys.gameSession 패턴: voice:game:session:{guildId}:{userId}
    const prefix = 'voice:game:session:';
    if (!key.startsWith(prefix)) return null;

    const remainder = key.slice(prefix.length);
    const colonIndex = remainder.indexOf(':');
    if (colonIndex === -1) return null;

    const guildId = remainder.slice(0, colonIndex);
    const userId = remainder.slice(colonIndex + 1);

    if (!guildId || !userId) return null;

    return { guildId, userId };
  }
}
