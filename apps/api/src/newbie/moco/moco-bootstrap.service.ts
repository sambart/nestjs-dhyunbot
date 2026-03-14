import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { MocoHuntingDaily } from '../domain/moco-hunting-daily.entity';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

interface HunterAggregateRow {
  hunterId: string;
  totalScore: string;
  totalChannelMinutes: string;
  totalSessionCount: string;
  totalUniqueNewbieCount: string;
}

@Injectable()
export class MocoBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MocoBootstrapService.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly newbieRedis: NewbieRedisRepository,
    @InjectRepository(MocoHuntingDaily)
    private readonly dailyRepo: Repository<MocoHuntingDaily>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.recoverAllGuilds();
    } catch (err) {
      this.logger.error('[MOCO BOOTSTRAP] Recovery failed', (err as Error).stack);
    }
  }

  private async recoverAllGuilds(): Promise<void> {
    const configs = await this.configRepo.findAllMocoEnabled();
    let totalRecovered = 0;

    for (const config of configs) {
      const hasRank = await this.newbieRedis.getMocoRankCount(config.guildId);
      if (hasRank > 0) continue; // Redis에 이미 데이터가 있으면 스킵

      const count = await this.recoverGuild(
        config.guildId,
        config.mocoCurrentPeriodStart ?? undefined,
      );
      if (count > 0) {
        totalRecovered += count;
      }
    }

    this.logger.log(
      `[MOCO BOOTSTRAP] Recovery complete. ${configs.length} guild(s) checked, ${totalRecovered} hunter(s) recovered.`,
    );
  }

  private async recoverGuild(guildId: string, fromDate?: string): Promise<number> {
    const qb = this.dailyRepo
      .createQueryBuilder('d')
      .select('d.hunterId', 'hunterId')
      .addSelect('SUM(d.score)', 'totalScore')
      .addSelect('SUM(d.channelMinutes)', 'totalChannelMinutes')
      .addSelect('SUM(d.sessionCount)', 'totalSessionCount')
      .addSelect('SUM(d.uniqueNewbieCount)', 'totalUniqueNewbieCount')
      .where('d.guildId = :guildId', { guildId })
      .groupBy('d.hunterId')
      .orderBy('"totalScore"', 'DESC');

    if (fromDate) {
      qb.andWhere('d.date >= :fromDate', { fromDate });
    }

    const rows = await qb.getRawMany<HunterAggregateRow>();
    if (rows.length === 0) return 0;

    for (const row of rows) {
      const score = parseInt(row.totalScore, 10);
      const totalMinutes = parseInt(row.totalChannelMinutes, 10);
      const sessionCount = parseInt(row.totalSessionCount, 10);
      const uniqueNewbieCount = parseInt(row.totalUniqueNewbieCount, 10);

      await this.newbieRedis.setMocoRankScore(guildId, row.hunterId, score);
      await this.newbieRedis.setMocoHunterMeta(guildId, row.hunterId, {
        score,
        sessionCount,
        uniqueNewbieCount,
        totalMinutes,
      });
    }

    this.logger.log(`[MOCO BOOTSTRAP] Recovered guild=${guildId}: ${rows.length} hunter(s)`);
    return rows.length;
  }
}
