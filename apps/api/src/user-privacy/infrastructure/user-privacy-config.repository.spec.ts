/**
 * UserPrivacyConfigRepository 단위 테스트
 * 대상: findOne, findManyByPeers, upsert
 *
 * TypeORM Repository는 jest.fn()으로 대체한다.
 */

import type { Mock } from 'vitest';

import type { UserPrivacyConfigOrm } from './user-privacy-config.orm-entity';
import { UserPrivacyConfigRepository } from './user-privacy-config.repository';

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

interface QueryBuilderMock {
  select: Mock;
  addSelect?: Mock;
  where: Mock;
  andWhere: Mock;
  getMany: Mock;
  insert: Mock;
  into: Mock;
  values: Mock;
  orUpdate: Mock;
  execute: Mock;
}

function makeQbMock(overrides: Partial<QueryBuilderMock> = {}): QueryBuilderMock {
  const qb: QueryBuilderMock = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    into: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    orUpdate: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return qb;
}

function makeTypeOrmRepo(qbMock: QueryBuilderMock) {
  return {
    findOne: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue(qbMock),
  };
}

describe('UserPrivacyConfigRepository', () => {
  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('R-1: PK(guildId, userId) 기반 단건 조회 시 레코드 반환', async () => {
      const entity = makeOrmEntity('guild-1', 'user-1', false);
      const typeOrmRepo = { findOne: vi.fn().mockResolvedValue(entity) };
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      const result = await repo.findOne('guild-1', 'user-1');

      expect(typeOrmRepo.findOne).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', userId: 'user-1' },
      });
      expect(result).toEqual(entity);
    });

    it('레코드 없으면 null 반환', async () => {
      const typeOrmRepo = { findOne: vi.fn().mockResolvedValue(null) };
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      const result = await repo.findOne('guild-1', 'user-x');

      expect(result).toBeNull();
    });
  });

  // ─── findManyByPeers ─────────────────────────────────────────────────────

  describe('findManyByPeers', () => {
    it('R-2: IN 절로 조회 후 Map<userId, disableRelationshipShare> 반환', async () => {
      const records = [makeOrmEntity('guild-1', 'u1', false), makeOrmEntity('guild-1', 'u2', true)];
      const qb = makeQbMock({ getMany: vi.fn().mockResolvedValue(records) });
      const typeOrmRepo = makeTypeOrmRepo(qb);
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      const result = await repo.findManyByPeers('guild-1', ['u1', 'u2']);

      expect(result.get('u1')).toBe(false);
      expect(result.get('u2')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('R-3: 빈 배열 입력 시 빈 Map 반환 (DB 호출 회피)', async () => {
      const typeOrmRepo = { createQueryBuilder: vi.fn() };
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      const result = await repo.findManyByPeers('guild-1', []);

      // DB QueryBuilder를 호출하지 않아야 한다
      expect(typeOrmRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('R-4: 신규 INSERT — execute가 호출된다', async () => {
      const qb = makeQbMock();
      const typeOrmRepo = makeTypeOrmRepo(qb);
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      await repo.upsert('guild-1', 'user-1', true);

      expect(qb.insert).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });

    it('R-5: ON CONFLICT 갱신 — orUpdate가 올바른 컬럼으로 호출된다', async () => {
      const qb = makeQbMock();
      const typeOrmRepo = makeTypeOrmRepo(qb);
      const repo = new UserPrivacyConfigRepository(typeOrmRepo as never);

      await repo.upsert('guild-1', 'user-1', false);

      // disableRelationshipShare, updatedAt 컬럼 갱신 + guildId, userId PK 충돌 처리
      expect(qb.orUpdate).toHaveBeenCalledWith(
        expect.arrayContaining(['disableRelationshipShare', 'updatedAt']),
        expect.arrayContaining(['guildId', 'userId']),
      );
    });
  });
});
