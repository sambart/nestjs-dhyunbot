import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { StatusPrefixApplyService } from './application/status-prefix-apply.service';
import { StatusPrefixConfigService } from './application/status-prefix-config.service';
import { StatusPrefixResetService } from './application/status-prefix-reset.service';
import { StatusPrefixButton } from './domain/status-prefix-button.entity';
import { StatusPrefixConfig } from './domain/status-prefix-config.entity';
import { StatusPrefixConfigRepository } from './infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from './infrastructure/status-prefix-redis.repository';
import { StatusPrefixInteractionHandler } from './interaction/status-prefix-interaction.handler';
import { StatusPrefixController } from './presentation/status-prefix.controller';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([StatusPrefixConfig, StatusPrefixButton]),
    AuthModule,
  ],
  controllers: [StatusPrefixController],
  providers: [
    StatusPrefixConfigRepository,
    StatusPrefixRedisRepository,
    StatusPrefixConfigService,
    StatusPrefixApplyService,
    StatusPrefixResetService,
    StatusPrefixInteractionHandler,
  ],
  exports: [
    StatusPrefixConfigService,
    StatusPrefixRedisRepository,
    StatusPrefixResetService, // VoiceLeaveHandler에서 주입받기 위해 export
  ],
})
export class StatusPrefixModule {}
