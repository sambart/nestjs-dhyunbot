import type { Repository } from 'typeorm';
import type { Mocked } from 'vitest';

import type { Member } from '../../../member/member.entity';
import type { VoiceDailyOrm } from '../infrastructure/voice-daily.orm-entity';
import { MemberSearchService } from './member-search.service';

describe('MemberSearchService', () => {
  let service: MemberSearchService;
  let voiceDailyRepo: Mocked<Repository<VoiceDailyOrm>>;
  let memberRepo: Mocked<Repository<Member>>;

  // QueryBuilder 체인 mock 헬퍼
  function makeQb(returnValue: unknown) {
    const qb = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue(returnValue),
      getMany: vi.fn().mockResolvedValue(returnValue),
    };
    return qb;
  }

  beforeEach(() => {
    voiceDailyRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<VoiceDailyOrm>>;

    memberRepo = {
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<Member>>;

    service = new MemberSearchService(voiceDailyRepo, memberRepo);
  });

  describe('search', () => {
    it('ILIKE 검색으로 userName에 쿼리가 포함된 사용자를 반환한다', async () => {
      const rows = [
        { userId: 'user-1', userName: 'Alice' },
        { userId: 'user-2', userName: 'Alice2' },
      ];
      const qb = makeQb(rows);
      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );

      const result = await service.search('guild-1', 'Alice');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ userId: 'user-1', userName: 'Alice' });
      expect(result[1]).toEqual({ userId: 'user-2', userName: 'Alice2' });
    });

    it('결과가 없으면 빈 배열을 반환한다', async () => {
      const qb = makeQb([]);
      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );

      const result = await service.search('guild-1', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('limit 20이 적용된다', async () => {
      const qb = makeQb([]);
      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );

      await service.search('guild-1', 'query');

      expect(qb.limit).toHaveBeenCalledWith(20);
    });

    it('ILIKE 검색 시 쿼리 앞뒤에 %가 붙는다', async () => {
      const qb = makeQb([]);
      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );

      await service.search('guild-1', 'abc');

      expect(qb.andWhere).toHaveBeenCalledWith('vd."userName" ILIKE :q', { q: '%abc%' });
    });

    it('guildId 필터가 적용된다', async () => {
      const qb = makeQb([]);
      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );

      await service.search('guild-999', 'test');

      expect(qb.where).toHaveBeenCalledWith('vd."guildId" = :guildId', { guildId: 'guild-999' });
    });
  });

  describe('getProfile', () => {
    it('존재하는 userId로 프로필을 반환한다', async () => {
      memberRepo.findOne.mockResolvedValue({
        discordMemberId: 'user-1',
        nickname: 'Alice',
        avatarUrl: 'https://cdn.discord.com/avatar.png',
      } as Member);

      const result = await service.getProfile('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: 'https://cdn.discord.com/avatar.png',
      });
    });

    it('존재하지 않는 userId이면 null을 반환한다', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      const result = await service.getProfile('no-exist');

      expect(result).toBeNull();
    });

    it('avatarUrl이 없으면 null을 반환한다', async () => {
      memberRepo.findOne.mockResolvedValue({
        discordMemberId: 'user-1',
        nickname: 'Bob',
        avatarUrl: undefined,
      } as unknown as Member);

      const result = await service.getProfile('user-1');

      expect(result?.avatarUrl).toBeNull();
    });
  });

  describe('getProfiles', () => {
    it('userIds 배열에 해당하는 멤버 프로필 맵을 반환한다', async () => {
      const members = [
        { discordMemberId: 'user-1', nickname: 'Alice', avatarUrl: 'avatar-1' },
        { discordMemberId: 'user-2', nickname: 'Bob', avatarUrl: null },
      ];
      const qb = makeQb(members);
      memberRepo.createQueryBuilder.mockReturnValue(
        qb as ReturnType<typeof memberRepo.createQueryBuilder>,
      );

      const result = await service.getProfiles(['user-1', 'user-2']);

      expect(result['user-1']).toEqual({ userName: 'Alice', avatarUrl: 'avatar-1' });
      expect(result['user-2']).toEqual({ userName: 'Bob', avatarUrl: null });
    });

    it('빈 배열을 전달하면 즉시 빈 객체를 반환한다 (DB 쿼리 없음)', async () => {
      const result = await service.getProfiles([]);

      expect(result).toEqual({});
      expect(memberRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
