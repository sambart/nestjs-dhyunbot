import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { InactiveMemberRecord } from '../inactive-member/domain/inactive-member-record.entity';
import { BotMetric } from '../monitoring/domain/bot-metric.entity';
import { NewbieModule } from '../newbie/newbie.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoiceDailyEntity, BotMetric, InactiveMemberRecord]),
    GatewayModule,
    NewbieModule,
    AuthModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
