import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { VoiceHealthConfig } from './domain/voice-health-config.entity';
import type { VoiceHealthConfigSaveDto } from './dto/voice-health-config-save.dto';
import { VoiceHealthKeys } from './voice-health-cache.keys';

const CONFIG_TTL = 3600;

@Injectable()
export class VoiceHealthConfigRepository {
  constructor(
    @InjectRepository(VoiceHealthConfig)
    private readonly repo: Repository<VoiceHealthConfig>,
    private readonly redis: RedisService,
  ) {}

  /**
   * guildId로 설정 단건 조회. Redis 캐시 히트 시 DB를 건너뛴다.
   */
  async findByGuildId(guildId: string): Promise<VoiceHealthConfig | null> {
    const cached = await this.redis.get<VoiceHealthConfig>(VoiceHealthKeys.config(guildId));
    if (cached) {
      return cached;
    }

    const config = await this.repo.findOne({ where: { guildId } });
    if (config) {
      await this.redis.set(VoiceHealthKeys.config(guildId), config, CONFIG_TTL);
    }
    return config;
  }

  /**
   * 설정 생성 또는 갱신 (guildId 기준). 저장 후 Redis 캐시를 갱신한다.
   */
  async upsert(guildId: string, dto: VoiceHealthConfigSaveDto): Promise<VoiceHealthConfig> {
    let config = await this.repo.findOne({ where: { guildId } });

    if (config) {
      config.isEnabled = dto.isEnabled;
      config.analysisDays = dto.analysisDays;
      config.isCooldownEnabled = dto.isCooldownEnabled;
      config.cooldownHours = dto.cooldownHours;
      config.isLlmSummaryEnabled = dto.isLlmSummaryEnabled;
      config.minActivityMinutes = dto.minActivityMinutes;
      config.minActiveDaysRatio = dto.minActiveDaysRatio;
      config.hhiThreshold = dto.hhiThreshold;
      config.minPeerCount = dto.minPeerCount;
      config.badgeActivityTopPercent = dto.badgeActivityTopPercent;
      config.badgeSocialHhiMax = dto.badgeSocialHhiMax;
      config.badgeSocialMinPeers = dto.badgeSocialMinPeers;
      config.badgeHunterTopPercent = dto.badgeHunterTopPercent;
      config.badgeConsistentMinRatio = dto.badgeConsistentMinRatio;
      config.badgeMicMinRate = dto.badgeMicMinRate;
    } else {
      config = this.repo.create({ guildId, ...dto });
    }

    const saved = await this.repo.save(config);
    await this.redis.set(VoiceHealthKeys.config(guildId), saved, CONFIG_TTL);
    return saved;
  }

  /** isEnabled=true인 모든 길드 조회. 배치 스케줄러 전용이므로 캐시 미사용. */
  async findAllEnabled(): Promise<VoiceHealthConfig[]> {
    return this.repo.find({ where: { isEnabled: true } });
  }

  /** Redis 캐시 삭제 */
  async deleteCache(guildId: string): Promise<void> {
    await this.redis.del(VoiceHealthKeys.config(guildId));
  }
}
