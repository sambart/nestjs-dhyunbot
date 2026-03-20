import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StickyMessageConfigService } from './application/sticky-message-config.service';
import { StickyMessageRefreshService } from './application/sticky-message-refresh.service';
import { StickyMessageConfigOrm } from './infrastructure/sticky-message-config.orm-entity';
import { StickyMessageConfigRepository } from './infrastructure/sticky-message-config.repository';
import { StickyMessageDiscordAdapter } from './infrastructure/sticky-message-discord.adapter';
import { StickyMessageRedisRepository } from './infrastructure/sticky-message-redis.repository';
import { StickyMessageController } from './presentation/sticky-message.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StickyMessageConfigOrm]),
    AuthModule,
  ],
  controllers: [StickyMessageController],
  providers: [
    StickyMessageDiscordAdapter,
    StickyMessageConfigRepository,
    StickyMessageRedisRepository,
    StickyMessageConfigService,
    StickyMessageRefreshService,
  ],
  exports: [
    StickyMessageConfigService,
    StickyMessageRefreshService,
    StickyMessageConfigRepository,
    StickyMessageRedisRepository,
  ],
})
export class StickyMessageModule {}
