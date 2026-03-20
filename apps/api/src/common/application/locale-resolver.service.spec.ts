import type { Repository } from 'typeorm';
import type { Mocked } from 'vitest';

import type { RedisService } from '../../redis/redis.service';
import type { GuildSettingOrmEntity as GuildSetting } from '../infrastructure/guild-setting.orm-entity';
import type { UserSettingOrmEntity as UserSetting } from '../infrastructure/user-setting.orm-entity';
import { LocaleResolverService } from './locale-resolver.service';

describe('LocaleResolverService', () => {
  let service: LocaleResolverService;
  let userSettingRepo: Mocked<Repository<UserSetting>>;
  let guildSettingRepo: Mocked<Repository<GuildSetting>>;
  let redis: Mocked<RedisService>;

  beforeEach(() => {
    userSettingRepo = {
      findOne: vi.fn(),
      upsert: vi.fn(),
    } as unknown as Mocked<Repository<UserSetting>>;

    guildSettingRepo = {
      findOne: vi.fn(),
      upsert: vi.fn(),
    } as unknown as Mocked<Repository<GuildSetting>>;

    redis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as Mocked<RedisService>;

    service = new LocaleResolverService(userSettingRepo, guildSettingRepo, redis);
  });

  describe('resolve — 우선순위 체인', () => {
    it('user setting이 있으면 user locale을 반환한다', async () => {
      redis.get.mockResolvedValueOnce('ko'); // user locale 캐시 히트

      const result = await service.resolve('user-1', 'guild-1', 'en-US');

      expect(result).toBe('ko');
      // guild setting은 조회하지 않아야 함
      expect(guildSettingRepo.findOne).not.toHaveBeenCalled();
    });

    it('user setting이 없고 guild setting이 있으면 guild locale을 반환한다', async () => {
      redis.get
        .mockResolvedValueOnce(null) // user locale 캐시 미스
        .mockResolvedValueOnce('ko'); // guild locale 캐시 히트

      const result = await service.resolve('user-1', 'guild-1', 'en-US');

      expect(result).toBe('ko');
    });

    it('user/guild setting이 없고 interactionLocale이 있으면 매핑된 locale을 반환한다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', 'guild-1', 'ko');

      expect(result).toBe('ko');
    });

    it('모든 설정이 없으면 기본값 en을 반환한다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', 'guild-1');

      expect(result).toBe('en');
    });

    it('guildId가 null이면 guild setting을 조회하지 않는다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', null);

      expect(guildSettingRepo.findOne).not.toHaveBeenCalled();
      expect(result).toBe('en');
    });
  });

  describe('getUserLocale — Redis 캐시', () => {
    it('Redis 캐시 히트 시 DB를 조회하지 않는다', async () => {
      redis.get.mockResolvedValue('ko');

      const result = await service.getUserLocale('user-1');

      expect(result).toBe('ko');
      expect(userSettingRepo.findOne).not.toHaveBeenCalled();
    });

    it('Redis 캐시 미스 시 DB를 조회하고 캐시를 저장한다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue({ locale: 'ko' } as UserSetting);
      redis.set.mockResolvedValue(undefined);

      const result = await service.getUserLocale('user-1');

      expect(result).toBe('ko');
      expect(redis.set).toHaveBeenCalledWith('locale:user:user-1', 'ko', 3600);
    });

    it('DB에도 없으면 null을 반환한다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserLocale('user-1');

      expect(result).toBeNull();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('getGuildLocale — Redis 캐시', () => {
    it('Redis 캐시 히트 시 DB를 조회하지 않는다', async () => {
      redis.get.mockResolvedValue('en');

      const result = await service.getGuildLocale('guild-1');

      expect(result).toBe('en');
      expect(guildSettingRepo.findOne).not.toHaveBeenCalled();
    });

    it('Redis 캐시 미스 시 DB를 조회하고 캐시를 저장한다', async () => {
      redis.get.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue({ locale: 'en' } as GuildSetting);
      redis.set.mockResolvedValue(undefined);

      const result = await service.getGuildLocale('guild-1');

      expect(result).toBe('en');
      expect(redis.set).toHaveBeenCalledWith('locale:guild:guild-1', 'en', 3600);
    });

    it('DB에도 없으면 null을 반환한다', async () => {
      redis.get.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.getGuildLocale('guild-1');

      expect(result).toBeNull();
    });
  });

  describe('setUserLocale', () => {
    it('DB에 upsert하고 Redis 캐시를 삭제한다', async () => {
      userSettingRepo.upsert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] });
      redis.del.mockResolvedValue(1);

      await service.setUserLocale('user-1', 'ko');

      expect(userSettingRepo.upsert).toHaveBeenCalledWith(
        { discordUserId: 'user-1', locale: 'ko' },
        ['discordUserId'],
      );
      expect(redis.del).toHaveBeenCalledWith('locale:user:user-1');
    });
  });

  describe('setGuildLocale', () => {
    it('DB에 upsert하고 Redis 캐시를 삭제한다', async () => {
      guildSettingRepo.upsert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] });
      redis.del.mockResolvedValue(1);

      await service.setGuildLocale('guild-1', 'ko');

      expect(guildSettingRepo.upsert).toHaveBeenCalledWith({ guildId: 'guild-1', locale: 'ko' }, [
        'guildId',
      ]);
      expect(redis.del).toHaveBeenCalledWith('locale:guild:guild-1');
    });
  });

  describe('interactionLocale 매핑', () => {
    it('ko-KR → ko로 매핑된다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', null, 'ko-KR');

      expect(result).toBe('ko');
    });

    it('en-US → en으로 매핑된다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', null, 'en-US');

      expect(result).toBe('en');
    });

    it('지원하지 않는 locale(ja)이면 기본값 en으로 폴백한다', async () => {
      redis.get.mockResolvedValue(null);
      userSettingRepo.findOne.mockResolvedValue(null);
      guildSettingRepo.findOne.mockResolvedValue(null);

      const result = await service.resolve('user-1', null, 'ja');

      expect(result).toBe('en');
    });
  });
});
