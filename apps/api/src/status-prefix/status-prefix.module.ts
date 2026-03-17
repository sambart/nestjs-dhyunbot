import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StatusPrefixApplyService } from './application/status-prefix-apply.service';
import { StatusPrefixConfigService } from './application/status-prefix-config.service';
import { StatusPrefixResetService } from './application/status-prefix-reset.service';
import { StatusPrefixButtonOrm } from './infrastructure/status-prefix-button.orm-entity';
import { StatusPrefixConfigOrm } from './infrastructure/status-prefix-config.orm-entity';
import { StatusPrefixConfigRepository } from './infrastructure/status-prefix-config.repository';
import { StatusPrefixDiscordAdapter } from './infrastructure/status-prefix-discord.adapter';
import { StatusPrefixRedisRepository } from './infrastructure/status-prefix-redis.repository';
import { StatusPrefixController } from './presentation/status-prefix.controller';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([StatusPrefixConfigOrm, StatusPrefixButtonOrm]),
    AuthModule,
  ],
  controllers: [StatusPrefixController],
  providers: [
    StatusPrefixConfigRepository,
    StatusPrefixDiscordAdapter,
    StatusPrefixRedisRepository,
    StatusPrefixConfigService,
    StatusPrefixApplyService,
    StatusPrefixResetService,
  ],
  exports: [
    StatusPrefixConfigService,
    StatusPrefixRedisRepository,
    StatusPrefixResetService, // VoiceLeaveHandler에서 주입받기 위해 export
  ],
})
export class StatusPrefixModule {}
