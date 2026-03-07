import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { AutoChannelConfigRepository } from '../infrastructure/auto-channel-config.repository';
import { AutoChannelRedisRepository } from '../infrastructure/auto-channel-redis.repository';

@Injectable()
export class AutoChannelBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutoChannelBootstrapService.name);

  constructor(
    private readonly configRepo: AutoChannelConfigRepository,
    private readonly redisRepo: AutoChannelRedisRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.initTriggerSets();
  }

  /**
   * DB의 모든 AutoChannelConfig를 읽어 guildId별로 그룹화한 뒤
   * Redis trigger set을 초기화한다.
   *
   * 방식: guildId별로 initTriggerSet() 호출 (기존 Set 삭제 후 재구성).
   * 봇 크래시 후 재기동 시 Redis 상태가 DB와 동기화됨을 보장한다.
   */
  private async initTriggerSets(): Promise<void> {
    const allConfigs = await this.configRepo.findAllConfigs();

    if (allConfigs.length === 0) {
      this.logger.log('No AutoChannelConfig found. Skipping trigger set initialization.');
      return;
    }

    // guildId → triggerChannelId[] 맵 구성
    const guildMap = new Map<string, string[]>();
    for (const config of allConfigs) {
      const list = guildMap.get(config.guildId) ?? [];
      list.push(config.triggerChannelId);
      guildMap.set(config.guildId, list);
    }

    // 각 서버별 Redis Set 초기화
    for (const [guildId, triggerChannelIds] of guildMap.entries()) {
      try {
        await this.redisRepo.initTriggerSet(guildId, triggerChannelIds);
        this.logger.log(
          `Initialized trigger set for guild=${guildId}: [${triggerChannelIds.join(', ')}]`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to init trigger set for guild=${guildId}`,
          (error as Error).stack,
        );
      }
    }

    this.logger.log(`AutoChannel bootstrap complete. ${guildMap.size} guild(s) initialized.`);
  }
}
