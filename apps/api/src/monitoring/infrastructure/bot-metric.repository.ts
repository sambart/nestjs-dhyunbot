import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { BotMetric } from '../domain/bot-metric.entity';

export interface AggregatedMetric {
  timestamp: string;
  online: boolean;
  pingMs: number;
  heapUsedMb: number;
  heapTotalMb: number;
  voiceUserCount: number;
  guildCount: number;
}

@Injectable()
export class BotMetricRepository {
  constructor(
    @InjectRepository(BotMetric)
    private readonly repo: Repository<BotMetric>,
  ) {}

  async save(metric: Partial<BotMetric>): Promise<BotMetric> {
    return this.repo.save(this.repo.create(metric));
  }

  async saveBatch(metrics: Partial<BotMetric>[]): Promise<void> {
    await this.repo.insert(metrics.map((m) => this.repo.create(m)));
  }

  async findByGuildAndRange(
    guildId: string,
    from: Date,
    to: Date,
  ): Promise<BotMetric[]> {
    return this.repo
      .createQueryBuilder('m')
      .where('m.guildId = :guildId', { guildId })
      .andWhere('m.recordedAt >= :from', { from })
      .andWhere('m.recordedAt <= :to', { to })
      .orderBy('m.recordedAt', 'ASC')
      .getMany();
  }

  async findAggregated(
    guildId: string,
    from: Date,
    to: Date,
    interval: string,
  ): Promise<AggregatedMetric[]> {
    const bucketExpr = this.toBucketExpression(interval);

    const raw: Array<{
      bucket: string;
      online_ratio: string;
      avg_ping: string;
      avg_heap_used: string;
      avg_heap_total: string;
      avg_voice_users: string;
      avg_guild_count: string;
    }> = await this.repo
      .createQueryBuilder('m')
      .select(bucketExpr, 'bucket')
      .addSelect(
        `AVG(CASE WHEN m.status = 'ONLINE' THEN 1 ELSE 0 END)`,
        'online_ratio',
      )
      .addSelect('AVG(m."pingMs")', 'avg_ping')
      .addSelect('AVG(m."heapUsedMb")', 'avg_heap_used')
      .addSelect('AVG(m."heapTotalMb")', 'avg_heap_total')
      .addSelect('AVG(m."voiceUserCount")', 'avg_voice_users')
      .addSelect('AVG(m."guildCount")', 'avg_guild_count')
      .where('m."guildId" = :guildId', { guildId })
      .andWhere('m."recordedAt" >= :from', { from })
      .andWhere('m."recordedAt" <= :to', { to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    return raw.map((r) => ({
      timestamp: r.bucket,
      online: parseFloat(r.online_ratio) >= 0.5,
      pingMs: Math.round(parseFloat(r.avg_ping)),
      heapUsedMb: parseFloat(parseFloat(r.avg_heap_used).toFixed(1)),
      heapTotalMb: parseFloat(parseFloat(r.avg_heap_total).toFixed(1)),
      voiceUserCount: Math.round(parseFloat(r.avg_voice_users)),
      guildCount: Math.round(parseFloat(r.avg_guild_count)),
    }));
  }

  async calculateAvailability(
    guildId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('m')
      .select(
        `AVG(CASE WHEN m.status = 'ONLINE' THEN 1 ELSE 0 END) * 100`,
        'availability',
      )
      .where('m."guildId" = :guildId', { guildId })
      .andWhere('m."recordedAt" >= :from', { from })
      .andWhere('m."recordedAt" <= :to', { to })
      .getRawOne();

    return result?.availability ? parseFloat(parseFloat(result.availability).toFixed(1)) : 0;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.repo.delete({ recordedAt: LessThan(date) });
    return result.affected ?? 0;
  }

  /**
   * interval 문자열을 PostgreSQL date_trunc/시간 산술 기반 버킷 표현식으로 변환.
   * 5m: PostgreSQL에 5분 단위 date_trunc이 없으므로 epoch 기반 산술로 처리.
   * whitelist 방식이므로 SQL 인젝션 위험 없음.
   */
  private toBucketExpression(interval: string): string {
    switch (interval) {
      case '5m':
        return `to_timestamp(floor(extract(epoch from m."recordedAt") / 300) * 300)`;
      case '1h':
        return `date_trunc('hour', m."recordedAt")`;
      case '1d':
        return `date_trunc('day', m."recordedAt")`;
      default:
        return `date_trunc('minute', m."recordedAt")`;
    }
  }
}
