import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VoiceChannelModule } from '../voice-channel.module';
import { CoPresenceScheduler } from './co-presence.scheduler';
import { CoPresenceService } from './co-presence.service';
import { CoPresenceCleanupScheduler } from './co-presence-cleanup.scheduler';
import { CoPresenceDbRepository } from './co-presence-db.repository';
import { VoiceCoPresenceDaily } from './domain/voice-co-presence-daily.entity';
import { VoiceCoPresencePairDaily } from './domain/voice-co-presence-pair-daily.entity';
import { VoiceCoPresenceSession } from './domain/voice-co-presence-session.entity';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      VoiceCoPresenceSession,
      VoiceCoPresenceDaily,
      VoiceCoPresencePairDaily,
    ]),
    VoiceChannelModule,
  ],
  providers: [
    CoPresenceScheduler,
    CoPresenceService,
    CoPresenceDbRepository,
    CoPresenceCleanupScheduler,
  ],
  exports: [CoPresenceScheduler],
})
export class CoPresenceModule {}
