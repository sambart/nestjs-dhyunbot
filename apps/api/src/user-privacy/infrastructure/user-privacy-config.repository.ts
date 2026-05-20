import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserPrivacyConfigOrm } from './user-privacy-config.orm-entity';

@Injectable()
export class UserPrivacyConfigRepository {
  constructor(
    @InjectRepository(UserPrivacyConfigOrm)
    private readonly repo: Repository<UserPrivacyConfigOrm>,
  ) {}

  /** PK(guildId, userId) 기반 단건 조회. 레코드 없으면 null 반환. */
  async findOne(guildId: string, userId: string): Promise<UserPrivacyConfigOrm | null> {
    return this.repo.findOne({ where: { guildId, userId } });
  }

  /**
   * 다수 userId의 프라이버시 설정을 배치 조회한다.
   * SELECT "userId", "disableRelationshipShare"
   * WHERE "guildId" = $1 AND "userId" = ANY($2)
   *
   * @returns userId → disableRelationshipShare Map (레코드 없는 userId는 포함 안 됨)
   */
  async findManyByPeers(guildId: string, userIds: string[]): Promise<Map<string, boolean>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const records = await this.repo
      .createQueryBuilder('p')
      .select(['p.userId', 'p.disableRelationshipShare'])
      .where('p.guildId = :guildId', { guildId })
      .andWhere('p.userId IN (:...userIds)', { userIds })
      .getMany();

    const resultMap = new Map<string, boolean>();
    for (const record of records) {
      resultMap.set(record.userId, record.disableRelationshipShare);
    }

    return resultMap;
  }

  /**
   * 프라이버시 설정을 upsert한다.
   * INSERT ... ON CONFLICT ("guildId", "userId") DO UPDATE
   *   SET "disableRelationshipShare" = EXCLUDED."disableRelationshipShare", "updatedAt" = now()
   */
  async upsert(guildId: string, userId: string, disableRelationshipShare: boolean): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(UserPrivacyConfigOrm)
      .values({ guildId, userId, disableRelationshipShare })
      .orUpdate(['disableRelationshipShare', 'updatedAt'], ['guildId', 'userId'])
      .execute();
  }
}
