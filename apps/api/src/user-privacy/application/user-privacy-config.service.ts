import { Injectable } from '@nestjs/common';

import { UserPrivacyConfigRepository } from '../infrastructure/user-privacy-config.repository';
import { UserPrivacyConfigCache } from './user-privacy-config.cache';

@Injectable()
export class UserPrivacyConfigService {
  constructor(
    private readonly repo: UserPrivacyConfigRepository,
    private readonly cache: UserPrivacyConfigCache,
  ) {}

  /**
   * 특정 사용자의 관계 공개 비활성화 여부를 반환한다.
   *
   * Redis 캐시 우선 조회. 캐시 미스 시 DB에서 읽어 캐시에 저장한다.
   * 레코드가 없으면 false(공개)로 취급하며 DB INSERT는 수행하지 않는다.
   */
  async isPrivate(guildId: string, userId: string): Promise<boolean> {
    const cached = await this.cache.getMany(guildId, [userId]);
    const cachedValue = cached.get(userId);

    // null: 캐시 미스 → DB 조회, boolean: 캐시 히트 → 바로 반환
    if (cachedValue !== null && cachedValue !== undefined) {
      return cachedValue;
    }

    return this.loadFromDbAndCache(guildId, userId);
  }

  /**
   * 다수 peerId의 익명 여부를 배치 조회한다.
   *
   * MGET으로 캐시를 일괄 조회하고, 미스된 ID만 DB에서 보충한다.
   * DB에 레코드가 없는 사용자도 isAnonymous: false로 매핑된다.
   *
   * @returns Map<peerId, { isAnonymous: boolean }>
   */
  async filterPeers(
    guildId: string,
    peerIds: string[],
  ): Promise<Map<string, { isAnonymous: boolean }>> {
    if (peerIds.length === 0) {
      return new Map();
    }

    const cacheResult = await this.cache.getMany(guildId, peerIds);
    const missIds = this.collectMissIds(peerIds, cacheResult);

    const dbMap = await this.fetchAndCacheMissIds(guildId, missIds);

    return this.buildPeerResultMap(peerIds, cacheResult, dbMap);
  }

  /**
   * 프라이버시 설정을 저장한다.
   *
   * DB upsert 후 Redis 캐시를 즉시 무효화한다.
   * 다음 isPrivate/filterPeers 호출 시 최신 DB 값으로 캐시가 채워진다.
   */
  async upsert(guildId: string, userId: string, disableRelationshipShare: boolean): Promise<void> {
    await this.repo.upsert(guildId, userId, disableRelationshipShare);
    await this.cache.invalidate(guildId, userId);
  }

  /**
   * 컨트롤러 응답 전용 단건 조회. 항상 DB에서 읽어 정합성을 보장한다.
   * 레코드가 없으면 `{ disableRelationshipShare: false }` 반환 (INSERT 안 함).
   */
  async getOne(guildId: string, userId: string): Promise<{ disableRelationshipShare: boolean }> {
    const record = await this.repo.findOne(guildId, userId);
    return { disableRelationshipShare: record?.disableRelationshipShare ?? false };
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private async loadFromDbAndCache(guildId: string, userId: string): Promise<boolean> {
    const record = await this.repo.findOne(guildId, userId);
    const isPrivate = record?.disableRelationshipShare ?? false;
    await this.cache.setMany(guildId, new Map([[userId, isPrivate]]));
    return isPrivate;
  }

  private collectMissIds(peerIds: string[], cacheResult: Map<string, boolean | null>): string[] {
    return peerIds.filter((id) => cacheResult.get(id) === null);
  }

  private async fetchAndCacheMissIds(
    guildId: string,
    missIds: string[],
  ): Promise<Map<string, boolean>> {
    if (missIds.length === 0) {
      return new Map();
    }

    const dbMap = await this.repo.findManyByPeers(guildId, missIds);

    // DB에 없는 사용자도 false(공개)로 캐시에 저장
    const toCache = new Map<string, boolean>();
    for (const missId of missIds) {
      toCache.set(missId, dbMap.get(missId) ?? false);
    }

    await this.cache.setMany(guildId, toCache);
    return dbMap;
  }

  private buildPeerResultMap(
    peerIds: string[],
    cacheResult: Map<string, boolean | null>,
    dbMap: Map<string, boolean>,
  ): Map<string, { isAnonymous: boolean }> {
    const result = new Map<string, { isAnonymous: boolean }>();

    for (const peerId of peerIds) {
      const cachedValue = cacheResult.get(peerId);
      const isAnonymous =
        cachedValue !== null && cachedValue !== undefined
          ? cachedValue
          : (dbMap.get(peerId) ?? false);

      result.set(peerId, { isAnonymous });
    }

    return result;
  }
}
