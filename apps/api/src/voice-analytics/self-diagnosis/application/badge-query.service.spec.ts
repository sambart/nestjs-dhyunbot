import { type Mock } from 'vitest';

import { BadgeQueryService } from './badge-query.service';

describe('BadgeQueryService', () => {
  let service: BadgeQueryService;
  let badgeRepo: { findOne: Mock };

  beforeEach(() => {
    badgeRepo = {
      findOne: vi.fn(),
    };

    service = new BadgeQueryService(badgeRepo as never);
  });

  describe('findBadgeCodes', () => {
    it('뱃지가 있으면 badges 배열 반환', async () => {
      badgeRepo.findOne.mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        badges: ['ACTIVE_7', 'SOCIAL_BUTTERFLY'],
      });

      const result = await service.findBadgeCodes('guild-1', 'user-1');

      expect(result).toEqual(['ACTIVE_7', 'SOCIAL_BUTTERFLY']);
      expect(badgeRepo.findOne).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', userId: 'user-1' },
        select: ['badges'],
      });
    });

    it('뱃지 레코드가 없으면 빈 배열 반환', async () => {
      badgeRepo.findOne.mockResolvedValue(null);

      const result = await service.findBadgeCodes('guild-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('badges가 빈 배열이면 빈 배열 반환', async () => {
      badgeRepo.findOne.mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        badges: [],
      });

      const result = await service.findBadgeCodes('guild-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('guildId와 userId를 모두 where 조건에 사용한다', async () => {
      badgeRepo.findOne.mockResolvedValue(null);

      await service.findBadgeCodes('guild-A', 'user-B');

      expect(badgeRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guildId: 'guild-A', userId: 'user-B' },
        }),
      );
    });

    it('badges 컬럼만 select한다', async () => {
      badgeRepo.findOne.mockResolvedValue(null);

      await service.findBadgeCodes('guild-1', 'user-1');

      expect(badgeRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          select: ['badges'],
        }),
      );
    });
  });
});
