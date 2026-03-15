import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Member } from '../../../member/member.entity';
import { VoiceChannelModule } from '../voice-channel.module';
import { CoPresenceScheduler } from './co-presence.scheduler';
import { CoPresenceService } from './co-presence.service';
import { CoPresenceAnalyticsController } from './co-presence-analytics.controller';
import { CoPresenceAnalyticsService } from './co-presence-analytics.service';
import { CoPresenceCleanupScheduler } from './co-presence-cleanup.scheduler';
import { CoPresenceDbRepository } from './co-presence-db.repository';
import { VoiceCoPresenceDailyOrm } from './infrastructure/voice-co-presence-daily.orm-entity';
import { VoiceCoPresencePairDailyOrm } from './infrastructure/voice-co-presence-pair-daily.orm-entity';
import { VoiceCoPresenceSessionOrm } from './infrastructure/voice-co-presence-session.orm-entity';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      VoiceCoPresenceSessionOrm,
      VoiceCoPresenceDailyOrm,
      VoiceCoPresencePairDailyOrm,
      Member,
    ]),
    VoiceChannelModule,
  ],
  controllers: [CoPresenceAnalyticsController],
  providers: [
    CoPresenceScheduler,
    CoPresenceService,
    CoPresenceDbRepository,
    CoPresenceCleanupScheduler,
    CoPresenceAnalyticsService,
  ],
  exports: [CoPresenceScheduler],
})
export class CoPresenceModule {}
