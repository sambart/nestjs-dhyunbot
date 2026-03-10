import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Status } from 'discord.js';

import { RedisService } from '../../redis/redis.service';
import { BotStatus } from '../domain/bot-metric.entity';
import {
  AggregatedMetric,
  BotMetricRepository,
} from '../infrastructure/bot-metric.repository';

export interface BotStatusResponse {
  online: boolean;
  uptimeMs: number;
  startedAt: string | null;
  pingMs: number;
  guildCount: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
  voiceUserCount: number;
}

export interface MetricsResponse {
  interval: string;
  availabilityPercent: number;
  data: AggregatedMetric[];
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private static readonly STATUS_CACHE_KEY = 'monitoring:status';
  private static readonly STATUS_CACHE_TTL = 10; // seconds

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly redis: RedisService,
    private readonly metricRepo: BotMetricRepository,
  ) {}

  async getStatus(guildId: string): Promise<BotStatusResponse> {
    const cached = await this.redis.get<BotStatusResponse>(
      `${MonitoringService.STATUS_CACHE_KEY}:${guildId}`,
    );
    if (cached) return cached;

    const status = this.collectStatus(guildId);

    await this.redis.set(
      `${MonitoringService.STATUS_CACHE_KEY}:${guildId}`,
      status,
      MonitoringService.STATUS_CACHE_TTL,
    );

    return status;
  }

  async getMetrics(
    guildId: string,
    from: Date,
    to: Date,
    interval: string,
  ): Promise<MetricsResponse> {
    const [data, availabilityPercent] = await Promise.all([
      interval === '1m'
        ? this.metricRepo
            .findByGuildAndRange(guildId, from, to)
            .then((rows) =>
              rows.map((r) => ({
                timestamp: r.recordedAt.toISOString(),
                online: r.status === BotStatus.ONLINE,
                pingMs: r.pingMs,
                heapUsedMb: r.heapUsedMb,
                heapTotalMb: r.heapTotalMb,
                voiceUserCount: r.voiceUserCount,
                guildCount: r.guildCount,
              })),
            )
        : this.metricRepo.findAggregated(guildId, from, to, interval),
      this.metricRepo.calculateAvailability(guildId, from, to),
    ]);

    return { interval, availabilityPercent, data };
  }

  collectStatus(guildId: string): BotStatusResponse {
    try {
      const isOnline = this.client.ws.status === Status.Ready;
      const mem = process.memoryUsage();
      const guild = this.client.guilds.cache.get(guildId);

      let voiceUserCount = 0;
      if (guild) {
        voiceUserCount = guild.voiceStates.cache.filter(
          (vs) => vs.channelId && vs.member?.user?.bot !== true,
        ).size;
      }

      return {
        online: isOnline,
        uptimeMs: this.client.uptime ?? 0,
        startedAt: this.client.readyAt?.toISOString() ?? null,
        pingMs: this.client.ws.ping,
        guildCount: this.client.guilds.cache.size,
        memoryUsage: {
          heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotalMb: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1)),
        },
        voiceUserCount,
      };
    } catch (error) {
      this.logger.error(
        '[MONITORING] Failed to collect status',
        (error as Error).stack,
      );
      return {
        online: false,
        uptimeMs: 0,
        startedAt: null,
        pingMs: 0,
        guildCount: 0,
        memoryUsage: { heapUsedMb: 0, heapTotalMb: 0 },
        voiceUserCount: 0,
      };
    }
  }

  collectAllGuildMetrics(): Array<{
    guildId: string;
    status: BotStatus;
    pingMs: number;
    heapUsedMb: number;
    heapTotalMb: number;
    voiceUserCount: number;
    guildCount: number;
  }> {
    const isOnline = this.client.ws.status === Status.Ready;
    const mem = process.memoryUsage();
    const guildCount = this.client.guilds.cache.size;
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1));
    const pingMs = this.client.ws.ping;
    const status = isOnline ? BotStatus.ONLINE : BotStatus.OFFLINE;

    return this.client.guilds.cache.map((guild) => {
      const voiceUserCount = guild.voiceStates.cache.filter(
        (vs) => vs.channelId && vs.member?.user?.bot !== true,
      ).size;

      return {
        guildId: guild.id,
        status,
        pingMs,
        heapUsedMb,
        heapTotalMb,
        voiceUserCount,
        guildCount,
      };
    });
  }
}
