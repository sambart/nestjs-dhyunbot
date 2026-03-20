import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RedisService } from '../../redis/redis.service';
import { GuildSettingOrmEntity as GuildSetting } from '../infrastructure/guild-setting.orm-entity';
import { UserSettingOrmEntity as UserSetting } from '../infrastructure/user-setting.orm-entity';

const SUPPORTED_LOCALES = ['ko', 'en'];
const DEFAULT_LOCALE = 'en';
const CACHE_TTL = 3600; // 1시간

/** Redis 캐시 키 */
const CacheKeys = {
  user: (userId: string) => `locale:user:${userId}`,
  guild: (guildId: string) => `locale:guild:${guildId}`,
};

/**
 * 봇 응답 언어를 결정하는 서비스.
 * 우선순위: user setting → guild setting → interaction.locale → default (en)
 */
@Injectable()
export class LocaleResolverService {
  private readonly logger = new Logger(LocaleResolverService.name);

  constructor(
    @InjectRepository(UserSetting)
    private readonly userSettingRepo: Repository<UserSetting>,
    @InjectRepository(GuildSetting)
    private readonly guildSettingRepo: Repository<GuildSetting>,
    private readonly redis: RedisService,
  ) {}

  async resolve(
    userId: string,
    guildId: string | null,
    interactionLocale?: string,
  ): Promise<string> {
    // 1. User setting (cached)
    const userLocale = await this.getUserLocale(userId);
    if (userLocale) return userLocale;

    // 2. Guild setting (cached)
    if (guildId) {
      const guildLocale = await this.getGuildLocale(guildId);
      if (guildLocale) return guildLocale;
    }

    // 3. Discord interaction.locale
    if (interactionLocale) {
      const mapped = this.mapDiscordLocale(interactionLocale);
      if (mapped) return mapped;
    }

    // 4. Default
    return DEFAULT_LOCALE;
  }

  async setUserLocale(userId: string, locale: string): Promise<void> {
    await this.userSettingRepo.upsert({ discordUserId: userId, locale }, ['discordUserId']);
    await this.redis.del(CacheKeys.user(userId));
  }

  async setGuildLocale(guildId: string, locale: string): Promise<void> {
    await this.guildSettingRepo.upsert({ guildId, locale }, ['guildId']);
    await this.redis.del(CacheKeys.guild(guildId));
  }

  async getUserLocale(userId: string): Promise<string | null> {
    const cached = await this.redis.get<string>(CacheKeys.user(userId));
    if (cached) return cached;

    const setting = await this.userSettingRepo.findOne({
      where: { discordUserId: userId },
    });
    if (setting) {
      await this.redis.set(CacheKeys.user(userId), setting.locale, CACHE_TTL);
      return setting.locale;
    }
    return null;
  }

  async getGuildLocale(guildId: string): Promise<string | null> {
    const cached = await this.redis.get<string>(CacheKeys.guild(guildId));
    if (cached) return cached;

    const setting = await this.guildSettingRepo.findOne({
      where: { guildId },
    });
    if (setting) {
      await this.redis.set(CacheKeys.guild(guildId), setting.locale, CACHE_TTL);
      return setting.locale;
    }
    return null;
  }

  private mapDiscordLocale(discordLocale: string): string | null {
    const prefix = discordLocale.slice(0, 2).toLowerCase();
    return SUPPORTED_LOCALES.includes(prefix) ? prefix : null;
  }
}
