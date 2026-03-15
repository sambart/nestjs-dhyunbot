import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Client } from 'discord.js';

import {
  CO_PRESENCE_SESSION_ENDED,
  CO_PRESENCE_TICK,
  CoPresenceSessionEndedEvent,
  CoPresenceTickEvent,
} from '../../channel/voice/co-presence/co-presence.events';
import { MocoDbRepository } from '../infrastructure/moco-db.repository';
import { NewbieConfigOrmEntity as NewbieConfig } from '../infrastructure/newbie-config.orm-entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

/** 마지막 유효 세션 시작 시각 (플레이횟수 시간 간격 병합용). key: `${guildId}:${hunterId}` */
const lastSessionStartedAt = new Map<string, number>();

@Injectable()
export class MocoEventHandler {
  private readonly logger = new Logger(MocoEventHandler.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly mocoDbRepo: MocoDbRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  // ── tick 이벤트: 실시간 Redis 누적 ──

  @OnEvent(CO_PRESENCE_TICK)
  async handleTick(event: CoPresenceTickEvent): Promise<void> {
    for (const snapshot of event.snapshots) {
      try {
        await this.processTickSnapshot(snapshot.guildId, snapshot.channelId, snapshot.userIds);
      } catch (err) {
        this.logger.error(
          `[MOCO EVENT] tick failed guild=${snapshot.guildId}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async processTickSnapshot(
    guildId: string,
    channelId: string,
    userIds: string[],
  ): Promise<void> {
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.mocoEnabled) return;

    const guild = this.discord.guilds.cache.get(guildId);
    if (!guild) return;

    const newbieDays = config.mocoNewbieDays ?? 30;
    const cutoff = Date.now() - newbieDays * 86_400_000;

    // 채널에서 모코코(신입) 식별
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return;

    const members = [...channel.members.values()].filter((m) => userIds.includes(m.id));

    const confirmedNewbies = members
      .filter((m) => !m.user.bot && m.joinedAt && m.joinedAt.getTime() >= cutoff)
      .map((m) => m.id);
    if (confirmedNewbies.length === 0) return;

    const newbieSet = new Set(confirmedNewbies);

    // 사냥꾼 식별
    const hunters = config.mocoAllowNewbieHunter
      ? userIds
      : userIds.filter((id) => !newbieSet.has(id));

    for (const hunterId of hunters) {
      const relevantNewbies = confirmedNewbies.filter((id) => id !== hunterId);
      if (relevantNewbies.length === 0) continue;

      // Redis에 1분 실시간 누적
      for (const newbieId of relevantNewbies) {
        await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, 1);
      }
      await this.newbieRedis.incrMocoChannelMinutes(guildId, hunterId, 1);
    }
  }

  // ── 세션 종료 이벤트: 유효성 판정 + DB 저장 + 랭크 갱신 ──

  @OnEvent(CO_PRESENCE_SESSION_ENDED)
  async handleSessionEnded(event: CoPresenceSessionEndedEvent): Promise<void> {
    try {
      await this.processSessionEnded(event);
    } catch (err) {
      this.logger.error(
        `[MOCO EVENT] session ended failed guild=${event.guildId} user=${event.userId}`,
        (err as Error).stack,
      );
    }
  }

  private async processSessionEnded(event: CoPresenceSessionEndedEvent): Promise<void> {
    const config = await this.configRepo.findByGuildId(event.guildId);
    if (!config?.mocoEnabled) return;

    const guild = this.discord.guilds.cache.get(event.guildId);
    if (!guild) return;

    const {
      guildId,
      userId: hunterId,
      channelId,
      startedAt,
      endedAt,
      durationMin,
      peerIds,
    } = event;
    const newbieDays = config.mocoNewbieDays ?? 30;
    const cutoff = Date.now() - newbieDays * 86_400_000;

    // 사냥꾼 자격 확인
    const hunterMember = guild.members.cache.get(hunterId);
    if (!hunterMember || hunterMember.user.bot) return;

    const isHunterNewbie = hunterMember.joinedAt && hunterMember.joinedAt.getTime() >= cutoff;
    if (isHunterNewbie && !config.mocoAllowNewbieHunter) return;

    // peerIds 중 모코코(신입) 필터링
    const confirmedNewbies: string[] = [];
    for (const peerId of peerIds) {
      if (peerId === hunterId) continue;
      const member = guild.members.cache.get(peerId);
      if (!member || member.user.bot) continue;
      if (member.joinedAt && member.joinedAt.getTime() >= cutoff) {
        confirmedNewbies.push(peerId);
      }
    }
    if (confirmedNewbies.length === 0) return;

    const minMinutes = config.mocoMinCoPresenceMin ?? 10;

    if (durationMin >= minMinutes) {
      // ── 유효 세션 ──
      await this.mocoDbRepo.saveSession({
        guildId,
        hunterId,
        channelId,
        startedAt,
        endedAt,
        durationMin,
        newbieMemberIds: confirmedNewbies,
        isValid: true,
      });

      // 플레이횟수 카운팅
      const countsAsPlay = this.shouldCountAsPlay(
        guildId,
        hunterId,
        startedAt,
        durationMin,
        config,
      );

      if (countsAsPlay) {
        await this.newbieRedis.incrMocoSessionCount(guildId, hunterId, 1);
        for (const newbieId of confirmedNewbies) {
          await this.newbieRedis.incrMocoNewbieSession(guildId, hunterId, newbieId, 1);
        }
      }

      // 일별 집계 upsert
      const scoreWeights = {
        perSession: config.mocoScorePerSession ?? 10,
        perMinute: config.mocoScorePerMinute ?? 1,
        perUnique: config.mocoScorePerUnique ?? 5,
      };

      await this.mocoDbRepo.upsertDaily(
        guildId,
        hunterId,
        this.toDateString(),
        {
          channelMinutes: durationMin,
          sessionCount: countsAsPlay ? 1 : 0,
          uniqueNewbieCount: confirmedNewbies.length,
        },
        scoreWeights,
      );

      // 점수 재계산 및 Redis 랭크 갱신
      await this.recalculateScore(guildId, hunterId, config);
    } else {
      // ── 무효 세션 — Redis 롤백 ──
      // tick 이벤트에서 누적한 분을 롤백
      await this.newbieRedis.incrMocoChannelMinutes(guildId, hunterId, -durationMin);

      for (const newbieId of confirmedNewbies) {
        const peerMin = event.peerMinutes[newbieId] ?? 0;
        if (peerMin > 0) {
          await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, -peerMin);
        }
      }

      // 무효 세션도 기록 (isValid=false)
      await this.mocoDbRepo.saveSession({
        guildId,
        hunterId,
        channelId,
        startedAt,
        endedAt,
        durationMin,
        newbieMemberIds: confirmedNewbies,
        isValid: false,
      });
    }
  }

  private shouldCountAsPlay(
    guildId: string,
    hunterId: string,
    startedAt: Date,
    durationMin: number,
    config: NewbieConfig,
  ): boolean {
    const key = `${guildId}:${hunterId}`;

    const minDuration = config.mocoPlayCountMinDurationMin;
    if (minDuration !== null && minDuration !== undefined && durationMin < minDuration) {
      return false;
    }

    const intervalMin = config.mocoPlayCountIntervalMin;
    if (intervalMin !== null && intervalMin !== undefined) {
      const lastStart = lastSessionStartedAt.get(key);
      if (lastStart && startedAt.getTime() - lastStart < intervalMin * 60_000) {
        return false;
      }
    }

    lastSessionStartedAt.set(key, startedAt.getTime());
    return true;
  }

  private async recalculateScore(
    guildId: string,
    hunterId: string,
    config: NewbieConfig,
  ): Promise<void> {
    const [channelMinutes, sessionCount, uniqueNewbieCount] = await Promise.all([
      this.newbieRedis.getMocoChannelMinutes(guildId, hunterId),
      this.newbieRedis.getMocoSessionCount(guildId, hunterId),
      this.newbieRedis.getMocoUniqueNewbieCount(guildId, hunterId),
    ]);

    const score =
      sessionCount * (config.mocoScorePerSession ?? 10) +
      channelMinutes * (config.mocoScorePerMinute ?? 1) +
      uniqueNewbieCount * (config.mocoScorePerUnique ?? 5);

    await this.newbieRedis.setMocoRankScore(guildId, hunterId, score);
    await this.newbieRedis.setMocoHunterMeta(guildId, hunterId, {
      score,
      sessionCount,
      uniqueNewbieCount,
      totalMinutes: channelMinutes,
    });
  }

  private toDateString(date: Date = new Date()): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
