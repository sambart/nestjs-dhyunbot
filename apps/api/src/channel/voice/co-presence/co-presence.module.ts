import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CanvasModule } from '../../../common/canvas/canvas.module';
import { GuildMemberModule } from '../../../guild-member/guild-member.module';
import { UserPrivacyModule } from '../../../user-privacy/user-privacy.module';
import { VoiceAnalyticsModule } from '../../../voice-analytics/voice-analytics.module';
import { VoiceChannelModule } from '../voice-channel.module';
import { AffinityCardRenderer } from './application/affinity-card-renderer';
import { BestFriendCardCacheService } from './application/best-friend-card.cache';
import { BestFriendCardRenderer } from './application/best-friend-card-renderer';
import { GuildCoPresenceConfigService } from './application/guild-co-presence-config.service';
import { CoPresenceScheduler } from './co-presence.scheduler';
import { CoPresenceService } from './co-presence.service';
import { CoPresenceAnalyticsController } from './co-presence-analytics.controller';
import { CoPresenceAnalyticsService } from './co-presence-analytics.service';
import { CoPresenceCleanupScheduler } from './co-presence-cleanup.scheduler';
import { CoPresenceDbRepository } from './co-presence-db.repository';
import { GuildCoPresenceConfigOrm } from './infrastructure/guild-co-presence-config.orm-entity';
import { GuildCoPresenceConfigRepository } from './infrastructure/guild-co-presence-config.repository';
import { VoiceCoPresenceDailyOrm } from './infrastructure/voice-co-presence-daily.orm-entity';
import { VoiceCoPresencePairDailyOrm } from './infrastructure/voice-co-presence-pair-daily.orm-entity';
import { VoiceCoPresenceSessionOrm } from './infrastructure/voice-co-presence-session.orm-entity';
import { GuildCoPresenceConfigController } from './presentation/guild-co-presence-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VoiceCoPresenceSessionOrm,
      VoiceCoPresenceDailyOrm,
      VoiceCoPresencePairDailyOrm,
      GuildCoPresenceConfigOrm,
    ]),
    VoiceChannelModule,
    UserPrivacyModule,
    CanvasModule,
    GuildMemberModule,
    // VoiceAnalyticsModule ↔ CoPresenceModule 양방향 의존 — forwardRef로 순환 참조 해소
    forwardRef(() => VoiceAnalyticsModule),
    // RedisModule은 @Global이므로 명시 import 불필요
  ],
  controllers: [CoPresenceAnalyticsController, GuildCoPresenceConfigController],
  providers: [
    CoPresenceScheduler,
    CoPresenceService,
    CoPresenceDbRepository,
    CoPresenceCleanupScheduler,
    CoPresenceAnalyticsService,
    GuildCoPresenceConfigRepository,
    GuildCoPresenceConfigService,
    BestFriendCardRenderer,
    AffinityCardRenderer,
    BestFriendCardCacheService,
  ],
  exports: [
    CoPresenceScheduler,
    CoPresenceService,
    CoPresenceAnalyticsService,
    GuildCoPresenceConfigService,
    BestFriendCardRenderer,
    AffinityCardRenderer,
    BestFriendCardCacheService,
  ],
})
export class CoPresenceModule {}
