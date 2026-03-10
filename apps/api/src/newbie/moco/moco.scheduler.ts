import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Client, Guild, VoiceBasedChannel } from 'discord.js';

import { VoiceExcludedChannelService } from '../../channel/voice/application/voice-excluded-channel.service';
import { NewbieConfig } from '../domain/newbie-config.entity';
import { MocoDbRepository } from '../infrastructure/moco-db.repository';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

/** 모코코 사냥 시간 누적 주기 (밀리초) */
const INTERVAL_MS = 60_000; // 1분

interface ActiveSession {
  guildId: string;
  hunterId: string;
  channelId: string;
  startedAt: Date;
  accumulatedMinutes: number;
  newbiesSeen: Set<string>;
  newbieMinutes: Map<string, number>; // per-newbie minutes within this session
}

@Injectable()
export class MocoScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MocoScheduler.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  /** key: `${guildId}:${hunterId}` */
  private activeSessions = new Map<string, ActiveSession>();

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    private readonly excludedChannelService: VoiceExcludedChannelService,
    private readonly mocoDbRepo: MocoDbRepository,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  onApplicationBootstrap(): void {
    this.intervalId = setInterval(() => void this.tick(), INTERVAL_MS);
    this.logger.log('[MOCO SCHEDULER] Started (interval=60s)');
  }

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 모든 활성 세션 종료
    const guildIds = new Set(
      [...this.activeSessions.values()].map((s) => s.guildId),
    );
    const configMap = new Map<string, NewbieConfig>();
    for (const guildId of guildIds) {
      const config = await this.configRepo.findByGuildId(guildId);
      if (config) configMap.set(guildId, config);
    }

    for (const [key, session] of this.activeSessions) {
      const config = configMap.get(session.guildId);
      if (config) {
        await this.endSession(session, config);
      }
      this.activeSessions.delete(key);
    }

    this.logger.log('[MOCO SCHEDULER] Stopped (all sessions ended)');
  }

  /**
   * 매 1분마다 실행. 봇이 참여 중인 모든 길드의 음성 채널을 순회하며
   * 신규사용자(모코코)와 기존 멤버(사냥꾼)가 함께 있는 채널에 대해 세션을 추적한다.
   */
  private async tick(): Promise<void> {
    if (this.isShuttingDown) return;

    for (const [guildId, guild] of this.discord.guilds.cache) {
      try {
        await this.processGuild(guildId, guild);
      } catch (err) {
        this.logger.error(
          `[MOCO SCHEDULER] Failed to process guild=${guildId}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async processGuild(guildId: string, guild: Guild): Promise<void> {
    // Step 1: mocoEnabled 확인, cutoff 계산
    const config = await this.configRepo.findByGuildId(guildId);
    if (!config?.mocoEnabled) return;

    const newbieDays = config.mocoNewbieDays ?? 30;
    const cutoff = Date.now() - newbieDays * 86_400_000;

    // Step 2: 음성 채널 순회하여 currentHunters 맵 구성
    const currentHunters = new Map<string, { channelId: string; newbieIds: string[] }>();

    for (const [, channel] of guild.channels.cache) {
      if (!channel.isVoiceBased()) continue;

      const voiceChannel = channel as VoiceBasedChannel;
      const members = [...voiceChannel.members.values()];
      if (members.length < 2) continue;

      // 제외 채널 확인
      const excluded = await this.excludedChannelService.isExcludedChannel(
        guildId,
        voiceChannel.id,
        voiceChannel.parentId ?? null,
      );
      if (excluded) continue;

      // 신규사용자(모코코) 식별
      const confirmedNewbies = members
        .filter((m) => m.joinedAt && m.joinedAt.getTime() >= cutoff)
        .map((m) => m.id);
      if (confirmedNewbies.length === 0) continue;

      // 사냥꾼 식별
      const memberIds = members.map((m) => m.id);
      const newbieSet = new Set(confirmedNewbies);
      const hunters = config.mocoAllowNewbieHunter
        ? memberIds
        : memberIds.filter((id) => !newbieSet.has(id));

      for (const hunterId of hunters) {
        const relevantNewbies = confirmedNewbies.filter((id) => id !== hunterId);
        if (relevantNewbies.length === 0) continue;

        currentHunters.set(hunterId, {
          channelId: voiceChannel.id,
          newbieIds: relevantNewbies,
        });
      }
    }

    // Step 3: 세션 조정
    await this.reconcileSessions(guildId, currentHunters, config);
  }

  /**
   * 현재 활성 사냥꾼 목록과 기존 세션을 비교하여
   * 세션을 시작/계속/종료한다.
   */
  private async reconcileSessions(
    guildId: string,
    currentHunters: Map<string, { channelId: string; newbieIds: string[] }>,
    config: NewbieConfig,
  ): Promise<void> {
    // 현재 활성 사냥꾼 처리
    for (const [hunterId, { channelId, newbieIds }] of currentHunters) {
      const key = `${guildId}:${hunterId}`;
      const existing = this.activeSessions.get(key);

      if (existing) {
        if (existing.channelId === channelId) {
          // 같은 채널 → 계속
          await this.continueSession(existing, newbieIds);
        } else {
          // 다른 채널 → 기존 종료 후 새로 시작
          await this.endSession(existing, config);
          this.activeSessions.delete(key);
          await this.startSession(guildId, hunterId, channelId, newbieIds);
        }
      } else {
        // 새 세션 시작
        await this.startSession(guildId, hunterId, channelId, newbieIds);
      }
    }

    // currentHunters에 없는 기존 세션 종료
    for (const [key, session] of this.activeSessions) {
      if (session.guildId !== guildId) continue;
      const hunterId = session.hunterId;
      if (!currentHunters.has(hunterId)) {
        await this.endSession(session, config);
        this.activeSessions.delete(key);
      }
    }
  }

  /**
   * 새 세션을 시작하고 첫 1분을 기록한다.
   */
  private async startSession(
    guildId: string,
    hunterId: string,
    channelId: string,
    newbieIds: string[],
  ): Promise<void> {
    const session: ActiveSession = {
      guildId,
      hunterId,
      channelId,
      startedAt: new Date(),
      accumulatedMinutes: 1,
      newbiesSeen: new Set(newbieIds),
      newbieMinutes: new Map(newbieIds.map((id) => [id, 1])),
    };

    const key = `${guildId}:${hunterId}`;
    this.activeSessions.set(key, session);

    // Redis에 첫 1분 기록
    for (const newbieId of newbieIds) {
      await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, 1);
    }
    await this.newbieRedis.incrMocoChannelMinutes(guildId, hunterId, 1);
  }

  /**
   * 기존 세션에 1분을 추가한다.
   */
  private async continueSession(
    session: ActiveSession,
    newbieIds: string[],
  ): Promise<void> {
    session.accumulatedMinutes += 1;

    for (const newbieId of newbieIds) {
      await this.newbieRedis.incrMocoMinutes(session.guildId, session.hunterId, newbieId, 1);
      session.newbiesSeen.add(newbieId);
      session.newbieMinutes.set(
        newbieId,
        (session.newbieMinutes.get(newbieId) ?? 0) + 1,
      );
    }

    await this.newbieRedis.incrMocoChannelMinutes(session.guildId, session.hunterId, 1);
  }

  /**
   * 세션을 종료한다.
   * 최소 동석 시간 조건을 충족하면 유효 세션으로 저장하고 점수를 재계산한다.
   * 미달 시 Redis에 기록한 분을 롤백한다.
   */
  private async endSession(session: ActiveSession, config: NewbieConfig): Promise<void> {
    const { guildId, hunterId, channelId, startedAt, accumulatedMinutes } = session;
    const minMinutes = config.mocoMinCoPresenceMin ?? 10;
    const endedAt = new Date();

    if (accumulatedMinutes >= minMinutes) {
      // ── 유효 세션 ──
      await this.mocoDbRepo.saveSession({
        guildId,
        hunterId,
        channelId,
        startedAt,
        endedAt,
        durationMin: accumulatedMinutes,
        newbieMemberIds: [...session.newbiesSeen],
        isValid: true,
      });

      await this.newbieRedis.incrMocoSessionCount(guildId, hunterId, 1);

      for (const newbieId of session.newbiesSeen) {
        await this.newbieRedis.incrMocoNewbieSession(guildId, hunterId, newbieId, 1);
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
          channelMinutes: accumulatedMinutes,
          sessionCount: 1,
          uniqueNewbieCount: session.newbiesSeen.size,
        },
        scoreWeights,
      );

      // 점수 재계산 및 Redis 랭크 갱신
      await this.recalculateScore(guildId, hunterId, config);
    } else {
      // ── 무효 세션 — 롤백 ──
      await this.newbieRedis.incrMocoChannelMinutes(guildId, hunterId, -accumulatedMinutes);

      for (const [newbieId, minutes] of session.newbieMinutes) {
        await this.newbieRedis.incrMocoMinutes(guildId, hunterId, newbieId, -minutes);
      }

      // 무효 세션도 기록 (isValid=false)
      await this.mocoDbRepo.saveSession({
        guildId,
        hunterId,
        channelId,
        startedAt,
        endedAt,
        durationMin: accumulatedMinutes,
        newbieMemberIds: [...session.newbiesSeen],
        isValid: false,
      });
    }
  }

  /**
   * Redis에서 누적 데이터를 읽어 점수를 재계산하고 랭크를 갱신한다.
   */
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

  /**
   * 특정 길드의 모든 활성 세션을 강제 종료한다.
   * 리셋 스케줄러가 Redis 키 삭제 전에 호출하여 세션 데이터 정합성을 보장한다.
   */
  async flushGuildSessions(guildId: string): Promise<void> {
    const config = await this.configRepo.findByGuildId(guildId);

    for (const [key, session] of this.activeSessions) {
      if (session.guildId !== guildId) continue;

      if (config) {
        await this.endSession(session, config);
      }
      this.activeSessions.delete(key);
    }
  }

  /**
   * 현재 시각을 KST 날짜 문자열(YYYYMMDD)로 변환한다.
   */
  private toDateString(date: Date = new Date()): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10).replace(/-/g, '');
  }
}
