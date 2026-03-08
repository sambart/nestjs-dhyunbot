import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { AutoChannelChannelEmptyHandler } from '../../event/auto-channel/auto-channel-channel-empty.handler';
import { AutoChannelInteractionHandler } from '../../event/auto-channel/auto-channel-interaction.handler';
import { DiscordVoiceGateway } from '../voice/infrastructure/discord-voice.gateway';
import { VoiceChannelModule } from '../voice/voice-channel.module';
import { AutoChannelService } from './application/auto-channel.service';
import { AutoChannelBootstrapService } from './application/auto-channel-bootstrap.service';
import { AutoChannelController } from './auto-channel.controller';
import { AutoChannelButton } from './domain/auto-channel-button.entity';
import { AutoChannelConfig } from './domain/auto-channel-config.entity';
import { AutoChannelSubOption } from './domain/auto-channel-sub-option.entity';
import { AutoChannelConfigRepository } from './infrastructure/auto-channel-config.repository';
import { AutoChannelDiscordGateway } from './infrastructure/auto-channel-discord.gateway';
import { AutoChannelRedisRepository } from './infrastructure/auto-channel-redis.repository';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([AutoChannelConfig, AutoChannelButton, AutoChannelSubOption]),
    AuthModule,
    VoiceChannelModule,
  ],
  controllers: [AutoChannelController],
  providers: [
    AutoChannelConfigRepository,
    AutoChannelRedisRepository,
    AutoChannelDiscordGateway,
    AutoChannelBootstrapService,
    AutoChannelService,
    AutoChannelChannelEmptyHandler,
    AutoChannelInteractionHandler,
    DiscordVoiceGateway,
  ],
  exports: [
    AutoChannelConfigRepository,
    AutoChannelRedisRepository,
    AutoChannelDiscordGateway,
    AutoChannelService,
  ],
})
export class AutoChannelModule {}
