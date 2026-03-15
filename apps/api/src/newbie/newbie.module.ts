import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CoPresenceModule } from '../channel/voice/co-presence/co-presence.module';
import { VoiceChannelHistoryOrm } from '../channel/voice/infrastructure/voice-channel-history.orm-entity';
import { VoiceDailyOrm } from '../channel/voice/infrastructure/voice-daily.orm-entity';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { RedisModule } from '../redis/redis.module';
import { MissionScheduler } from './application/mission/mission.scheduler';
import { MissionService } from './application/mission/mission.service';
import { MocoService } from './application/moco/moco.service';
import { MocoBootstrapService } from './application/moco/moco-bootstrap.service';
import { MocoEventHandler } from './application/moco/moco-event.handler';
import { MocoResetScheduler } from './application/moco/moco-reset.scheduler';
import { NewbieRoleScheduler } from './application/role/newbie-role.scheduler';
import { NewbieRoleService } from './application/role/newbie-role.service';
import { WelcomeService } from './application/welcome/welcome.service';
import { MocoDbRepository } from './infrastructure/moco-db.repository';
import { MocoHuntingDailyOrmEntity } from './infrastructure/moco-hunting-daily.orm-entity';
import { MocoHuntingSessionOrmEntity } from './infrastructure/moco-hunting-session.orm-entity';
import { NewbieConfigOrmEntity } from './infrastructure/newbie-config.orm-entity';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieMissionOrmEntity } from './infrastructure/newbie-mission.orm-entity';
import { NewbieMissionRepository } from './infrastructure/newbie-mission.repository';
import { NewbieMissionTemplateOrmEntity } from './infrastructure/newbie-mission-template.orm-entity';
import { NewbieMissionTemplateRepository } from './infrastructure/newbie-mission-template.repository';
import { NewbieMocoTemplateOrmEntity } from './infrastructure/newbie-moco-template.orm-entity';
import { NewbieMocoTemplateRepository } from './infrastructure/newbie-moco-template.repository';
import { NewbiePeriodOrmEntity } from './infrastructure/newbie-period.orm-entity';
import { NewbiePeriodRepository } from './infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';
import { NewbieController } from './presentation/newbie.controller';
import { NewbieGateway } from './presentation/newbie.gateway';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      NewbieConfigOrmEntity,
      NewbieMissionTemplateOrmEntity,
      NewbieMissionOrmEntity,
      NewbieMocoTemplateOrmEntity,
      NewbiePeriodOrmEntity,
      MocoHuntingSessionOrmEntity,
      MocoHuntingDailyOrmEntity,
      VoiceDailyOrm,
      VoiceChannelHistoryOrm,
    ]),
    CoPresenceModule,
    VoiceChannelModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [NewbieController],
  providers: [
    // 저장소
    MocoDbRepository,
    NewbieConfigRepository,
    NewbieMissionRepository,
    NewbieMissionTemplateRepository,
    NewbieMocoTemplateRepository,
    NewbiePeriodRepository,
    NewbieRedisRepository,
    // 핵심 (Unit A)
    NewbieGateway,
    // Unit B
    WelcomeService,
    // Unit C
    MissionService,
    MissionScheduler,
    // Unit D
    MocoService,
    MocoBootstrapService,
    MocoEventHandler,
    MocoResetScheduler,
    // Unit E
    NewbieRoleService,
    NewbieRoleScheduler,
  ],
  exports: [
    MocoDbRepository,
    NewbieConfigRepository,
    NewbieMissionRepository,
    NewbieMissionTemplateRepository,
    NewbieMocoTemplateRepository,
    NewbiePeriodRepository,
    NewbieRedisRepository,
    MissionService,
    MocoService,
  ],
})
export class NewbieModule {}
