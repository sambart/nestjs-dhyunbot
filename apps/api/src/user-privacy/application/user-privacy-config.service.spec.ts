/**
 * UserPrivacyConfigService 단위 테스트
 * 대상: isPrivate, filterPeers, upsert, getOne
 *
 * 외부 의존성(Repository, Cache)은 vi.fn()으로 대체한다.
 */

import type { Mock } from 'vitest';

import type { UserPrivacyConfigOrm } from '../infrastructure/user-privacy-config.orm-entity';
import type { UserPrivacyConfigRepository } from '../infrastructure/user-privacy-config.repository';
import type { UserPrivacyConfigCache } from './user-privacy-config.cache';
import { UserPrivacyConfigService } from './user-privacy-config.service';

// ─── mock 헬퍼 ────────────────────────────────────────────────────────────────

function makeOrmEntity(
  guildId: string,
  userId: string,
  disableRelationshipShare: boolean,
): UserPrivacyConfigOrm {
  return {
    guildId,
    userId,
    disableRelationshipShare,
    updatedAt: new Date(),
  } as UserPrivacyConfigOrm;
}

function makeRepo(): jest.Mocked<UserPrivacyConfigRepository> {
  return {
    findOne: vi.fn(),
    findManyByPeers: vi.fn(),
    upsert: vi.fn(),
  } as unknown as jest.Mocked<UserPrivacyConfigRepository>;
}

function makeCache(): jest.Mocked<UserPrivacyConfigCache> {
  return {
    getMany: vi.fn(),
    setMany: vi.fn(),
    invalidate: vi.fn(),
  } as unknown as jest.Mocked<UserPrivacyConfigCache>;
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('UserPrivacyConfigService', () => {
  let service: UserPrivacyConfigService;
  let repo: ReturnType<typeof makeRepo>;
  let cache: ReturnType<typeof makeCache>;

  beforeEach(() => {
    repo = makeRepo();
    cache = makeCache();
    service = new UserPrivacyConfigService(
      repo as unknown as UserPrivacyConfigRepository,
      cache as unknown as UserPrivacyConfigCache,
    );
    vi.clearAllMocks();
  });

  // ─── isPrivate ────────────────────────────────────────────────────────────

  describe('isPrivate', () => {
    it('U-1: 캐시 히트 — 공개("0") 시 DB 조회 없이 false 반환', async () => {
      (cache.getMany as Mock).mockResolvedValue(new Map([['user-1', false]]));

      const result = await service.isPrivate('guild-1', 'user-1');

      expect(result).toBe(false);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('U-2: 캐시 히트 — 비공개("1") 시 DB 조회 없이 true 반환', async () => {
      (cache.getMany as Mock).mockResolvedValue(new Map([['user-1', true]]));

      const result = await service.isPrivate('guild-1', 'user-1');

      expect(result).toBe(true);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('U-3: 캐시 미스 + 레코드 있음(false) → DB 조회, 캐시 SET "0", false 반환', async () => {
      (cache.getMany as Mock).mockResolvedValue(new Map([['user-1', null]]));
      (repo.findOne as Mock).mockResolvedValue(makeOrmEntity('guild-1', 'user-1', false));
      (cache.setMany as Mock).mockResolvedValue(undefined);

      const result = await service.isPrivate('guild-1', 'user-1');

      expect(result).toBe(false);
      expect(repo.findOne).toHaveBeenCalledWith('guild-1', 'user-1');
      expect(cache.setMany).toHaveBeenCalledWith('guild-1', new Map([['user-1', false]]));
    });

    it('U-4: 캐시 미스 + 레코드 있음(true) → DB 조회, 캐시 SET "1", true 반환', async () => {
      (cache.getMany as Mock).mockResolvedValue(new Map([['user-1', null]]));
      (repo.findOne as Mock).mockResolvedValue(makeOrmEntity('guild-1', 'user-1', true));
      (cache.setMany as Mock).mockResolvedValue(undefined);

      const result = await service.isPrivate('guild-1', 'user-1');

      expect(result).toBe(true);
      expect(cache.setMany).toHaveBeenCalledWith('guild-1', new Map([['user-1', true]]));
    });

    it('U-5: 캐시 미스 + 레코드 없음 → DB null 반환, 캐시 SET "0", false 반환', async () => {
      (cache.getMany as Mock).mockResolvedValue(new Map([['user-1', null]]));
      (repo.findOne as Mock).mockResolvedValue(null);
      (cache.setMany as Mock).mockResolvedValue(undefined);

      const result = await service.isPrivate('guild-1', 'user-1');

      expect(result).toBe(false);
      // 레코드 없어도 false(공개)로 캐시 저장
      expect(cache.setMany).toHaveBeenCalledWith('guild-1', new Map([['user-1', false]]));
    });
  });

  // ─── filterPeers ─────────────────────────────────────────────────────────

  describe('filterPeers', () => {
    it('U-6: 빈 배열 입력 시 즉시 빈 Map 반환, Redis/DB 호출 0회', async () => {
      const result = await service.filterPeers('guild-1', []);

      expect(result.size).toBe(0);
      expect(cache.getMany).not.toHaveBeenCalled();
      expect(repo.findManyByPeers).not.toHaveBeenCalled();
    });

    it('U-7: 전부 캐시 히트 시 DB 조회 0회, 결과 Map 정확성 확인', async () => {
      const cacheResult = new Map([
        ['p1', false],
        ['p2', true],
        ['p3', false],
      ]);
      (cache.getMany as Mock).mockResolvedValue(cacheResult);

      const result = await service.filterPeers('guild-1', ['p1', 'p2', 'p3']);

      expect(repo.findManyByPeers).not.toHaveBeenCalled();
      expect(result.get('p1')).toEqual({ isAnonymous: false });
      expect(result.get('p2')).toEqual({ isAnonymous: true });
      expect(result.get('p3')).toEqual({ isAnonymous: false });
    });

    it('U-8: 일부 미스 시 미스 ID만 DB IN 절로 조회, 결과 Map에 누락 없음', async () => {
      // p1=히트(false), p2=히트(true), p3=미스, p4=미스
      const cacheResult = new Map<string, boolean | null>([
        ['p1', false],
        ['p2', true],
        ['p3', null],
        ['p4', null],
      ]);
      (cache.getMany as Mock).mockResolvedValue(cacheResult);
      // DB에서 p3만 반환 (p4는 레코드 없음)
      (repo.findManyByPeers as Mock).mockResolvedValue(new Map([['p3', false]]));
      (cache.setMany as Mock).mockResolvedValue(undefined);

      const result = await service.filterPeers('guild-1', ['p1', 'p2', 'p3', 'p4']);

      // 미스 ID만 DB 조회
      expect(repo.findManyByPeers).toHaveBeenCalledWith('guild-1', ['p3', 'p4']);
      // 전체 결과 정확성
      expect(result.get('p1')).toEqual({ isAnonymous: false });
      expect(result.get('p2')).toEqual({ isAnonymous: true });
      expect(result.get('p3')).toEqual({ isAnonymous: false });
      expect(result.get('p4')).toEqual({ isAnonymous: false });
    });

    it('U-9: 미스 ID 중 DB 레코드 없는 사용자 → isAnonymous: false + 캐시에 false 저장', async () => {
      const cacheResult = new Map<string, boolean | null>([['p1', null]]);
      (cache.getMany as Mock).mockResolvedValue(cacheResult);
      // DB에 레코드 없음
      (repo.findManyByPeers as Mock).mockResolvedValue(new Map());
      (cache.setMany as Mock).mockResolvedValue(undefined);

      const result = await service.filterPeers('guild-1', ['p1']);

      expect(result.get('p1')).toEqual({ isAnonymous: false });
      // DB에 없어도 false로 캐시 저장
      expect(cache.setMany).toHaveBeenCalledWith('guild-1', new Map([['p1', false]]));
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('U-10: upsert(true) 시 DB upsert 호출 + 캐시 DEL 호출', async () => {
      (repo.upsert as Mock).mockResolvedValue(undefined);
      (cache.invalidate as Mock).mockResolvedValue(undefined);

      await service.upsert('guild-1', 'user-1', true);

      expect(repo.upsert).toHaveBeenCalledWith('guild-1', 'user-1', true);
      expect(cache.invalidate).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    it('U-11: upsert(false) 시 DB upsert 호출 + 캐시 DEL 호출', async () => {
      (repo.upsert as Mock).mockResolvedValue(undefined);
      (cache.invalidate as Mock).mockResolvedValue(undefined);

      await service.upsert('guild-1', 'user-1', false);

      expect(repo.upsert).toHaveBeenCalledWith('guild-1', 'user-1', false);
      expect(cache.invalidate).toHaveBeenCalledWith('guild-1', 'user-1');
    });
  });

  // ─── getOne ──────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('U-12: 레코드 없으면 { disableRelationshipShare: false } 반환, 캐시 미사용', async () => {
      (repo.findOne as Mock).mockResolvedValue(null);

      const result = await service.getOne('guild-1', 'user-1');

      expect(result).toEqual({ disableRelationshipShare: false });
      // getOne은 항상 DB에서 직접 조회 (캐시 우회)
      expect(cache.getMany).not.toHaveBeenCalled();
    });

    it('레코드 있으면 DB 값 반환', async () => {
      (repo.findOne as Mock).mockResolvedValue(makeOrmEntity('guild-1', 'user-1', true));

      const result = await service.getOne('guild-1', 'user-1');

      expect(result).toEqual({ disableRelationshipShare: true });
    });
  });
});
