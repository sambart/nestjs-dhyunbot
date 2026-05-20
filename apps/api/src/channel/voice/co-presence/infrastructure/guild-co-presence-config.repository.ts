import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GuildCoPresenceConfigOrm } from './guild-co-presence-config.orm-entity';

/**
 * GuildCoPresenceConfig TypeORM Repository 래퍼.
 */
@Injectable()
export class GuildCoPresenceConfigRepository {
  constructor(
    @InjectRepository(GuildCoPresenceConfigOrm)
    private readonly repo: Repository<GuildCoPresenceConfigOrm>,
  ) {}

  /**
   * 길드 설정을 조회한다. 레코드가 없으면 null을 반환한다.
   */
  async findOne(guildId: string): Promise<GuildCoPresenceConfigOrm | null> {
    return this.repo.findOne({ where: { guildId } });
  }

  /**
   * 길드 설정을 upsert한다. updatedAt은 TypeORM @UpdateDateColumn이 자동 갱신한다.
   */
  async upsert(
    guildId: string,
    dto: { allowPublicAffinityQuery: boolean },
  ): Promise<GuildCoPresenceConfigOrm> {
    await this.repo.upsert({ guildId, ...dto }, ['guildId']);
    const saved = await this.repo.findOneOrFail({ where: { guildId } });
    return saved;
  }
}
