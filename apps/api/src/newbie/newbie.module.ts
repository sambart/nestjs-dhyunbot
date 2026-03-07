import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceChannelHistory } from '../channel/voice/domain/voice-channel-history.entity';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { RedisModule } from '../redis/redis.module';
import { NewbieConfig } from './domain/newbie-config.entity';
import { NewbieMission } from './domain/newbie-mission.entity';
import { NewbiePeriod } from './domain/newbie-period.entity';
import { NewbieConfigRepository } from './infrastructure/newbie-config.repository';
import { NewbieMissionRepository } from './infrastructure/newbie-mission.repository';
import { NewbiePeriodRepository } from './infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from './infrastructure/newbie-redis.repository';
import { MissionScheduler } from './mission/mission.scheduler';
import { MissionService } from './mission/mission.service';
import { MocoService } from './moco/moco.service';
import { NewbieController } from './newbie.controller';
import { NewbieGateway } from './newbie.gateway';
import { NewbieRoleScheduler } from './role/newbie-role.scheduler';
import { NewbieRoleService } from './role/newbie-role.service';
import { WelcomeService } from './welcome/welcome.service';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      NewbieConfig,
      NewbieMission,
      NewbiePeriod,
      VoiceDailyEntity,
      VoiceChannelHistory,
    ]),
    VoiceChannelModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [NewbieController],
  providers: [
    // 저장소
    NewbieConfigRepository,
    NewbieMissionRepository,
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
    // Unit E
    NewbieRoleService,
    NewbieRoleScheduler,
  ],
  exports: [
    NewbieConfigRepository,
    NewbieMissionRepository,
    NewbiePeriodRepository,
    NewbieRedisRepository,
    MissionService,
    MocoService,
  ],
})
export class NewbieModule {}
