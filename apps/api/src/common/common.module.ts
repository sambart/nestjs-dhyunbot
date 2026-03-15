import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { BotI18nService } from './application/bot-i18n.service';
import { LocaleResolverService } from './application/locale-resolver.service';
import { GuildSetting } from './domain/guild-setting.entity';
import { UserSetting } from './domain/user-setting.entity';
import { LocaleController } from './presentation/locale.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserSetting, GuildSetting]), RedisModule, AuthModule],
  controllers: [LocaleController],
  providers: [LocaleResolverService, BotI18nService],
  exports: [LocaleResolverService, BotI18nService],
})
export class CommonModule {}
