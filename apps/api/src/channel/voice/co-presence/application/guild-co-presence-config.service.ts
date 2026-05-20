import { Injectable } from '@nestjs/common';

import { GuildCoPresenceConfigOrm } from '../infrastructure/guild-co-presence-config.orm-entity';
import { GuildCoPresenceConfigRepository } from '../infrastructure/guild-co-presence-config.repository';

/**
 * 길드 단위 Co-Presence 공개 설정 서비스.
 * `allowPublicAffinityQuery` CRUD를 담당한다.
 */
@Injectable()
export class GuildCoPresenceConfigService {
  constructor(private readonly repo: GuildCoPresenceConfigRepository) {}

  /**
   * 길드 설정을 반환한다.
   * 레코드가 없으면 기본값 `{ allowPublicAffinityQuery: false }`를 포함한 객체를 반환한다.
   */
  async getConfig(guildId: string): Promise<GuildCoPresenceConfigOrm> {
    const record = await this.repo.findOne(guildId);
    if (record) return record;

    // 기본값 객체 반환 (DB INSERT 없이 메모리에서만 구성)
    const defaults = new GuildCoPresenceConfigOrm();
    defaults.guildId = guildId;
    defaults.allowPublicAffinityQuery = false;
    defaults.updatedAt = new Date();
    return defaults;
  }

  /**
   * 길드 설정을 upsert한다.
   */
  async upsert(
    guildId: string,
    dto: { allowPublicAffinityQuery: boolean },
  ): Promise<GuildCoPresenceConfigOrm> {
    return this.repo.upsert(guildId, dto);
  }
}
