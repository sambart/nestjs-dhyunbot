/**
 * GuildCoPresenceConfigService 단위 테스트
 * 대상: getConfig, upsert
 *
 * GuildCoPresenceConfigRepository는 jest.fn()으로 대체한다.
 */

import type { Mock } from 'vitest';

import { GuildCoPresenceConfigOrm } from '../infrastructure/guild-co-presence-config.orm-entity';
import type { GuildCoPresenceConfigRepository } from '../infrastructure/guild-co-presence-config.repository';
import { GuildCoPresenceConfigService } from './guild-co-presence-config.service';

// ─── mock 헬퍼 ────────────────────────────────────────────────────────────────

function makeOrmEntity(
  guildId: string,
  allowPublicAffinityQuery: boolean,
): GuildCoPresenceConfigOrm {
  const entity = new GuildCoPresenceConfigOrm();
  entity.guildId = guildId;
  entity.allowPublicAffinityQuery = allowPublicAffinityQuery;
  entity.updatedAt = new Date('2026-05-04T00:00:00Z');
  return entity;
}

function makeRepo(): jest.Mocked<GuildCoPresenceConfigRepository> {
  return {
    findOne: vi.fn(),
    upsert: vi.fn(),
  } as unknown as jest.Mocked<GuildCoPresenceConfigRepository>;
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('GuildCoPresenceConfigService', () => {
  let service: GuildCoPresenceConfigService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    service = new GuildCoPresenceConfigService(repo as unknown as GuildCoPresenceConfigRepository);
    vi.clearAllMocks();
  });

  // ─── getConfig ────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('T-GCC-01: 레코드 없으면 기본값 { allowPublicAffinityQuery: false } 반환', async () => {
      (repo.findOne as Mock).mockResolvedValue(null);

      const result = await service.getConfig('guild-x');

      expect(result.guildId).toBe('guild-x');
      expect(result.allowPublicAffinityQuery).toBe(false);
      // DB INSERT 없이 메모리에서만 생성하므로 upsert는 호출되지 않아야 한다
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('레코드 있으면 DB 값 그대로 반환', async () => {
      const entity = makeOrmEntity('guild-1', true);
      (repo.findOne as Mock).mockResolvedValue(entity);

      const result = await service.getConfig('guild-1');

      expect(result.allowPublicAffinityQuery).toBe(true);
      expect(result).toBe(entity); // 동일 객체 참조
    });
  });

  // ─── upsert ──────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('T-GCC-02: 신규 upsert — repo.upsert 호출 후 저장된 엔티티 반환', async () => {
      const entity = makeOrmEntity('guild-1', true);
      (repo.upsert as Mock).mockResolvedValue(entity);

      const result = await service.upsert('guild-1', { allowPublicAffinityQuery: true });

      expect(repo.upsert).toHaveBeenCalledWith('guild-1', { allowPublicAffinityQuery: true });
      expect(result.allowPublicAffinityQuery).toBe(true);
    });

    it('T-GCC-03: 기존 레코드 갱신 — allowPublicAffinityQuery 값이 변경된 엔티티 반환', async () => {
      const updated = makeOrmEntity('guild-1', false);
      (repo.upsert as Mock).mockResolvedValue(updated);

      const result = await service.upsert('guild-1', { allowPublicAffinityQuery: false });

      expect(repo.upsert).toHaveBeenCalledWith('guild-1', { allowPublicAffinityQuery: false });
      expect(result.allowPublicAffinityQuery).toBe(false);
    });
  });
});
