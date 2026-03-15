import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceDailyOrm } from '../channel/voice/infrastructure/voice-daily.orm-entity';
import { GatewayModule } from '../gateway/gateway.module';
import { InactiveMemberRecordOrm } from '../inactive-member/infrastructure/inactive-member-record.orm-entity';
import { BotMetricOrm } from '../monitoring/infrastructure/bot-metric.orm-entity';
import { NewbieModule } from '../newbie/newbie.module';
import { OverviewService } from './application/overview.service';
import { OverviewController } from './presentation/overview.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoiceDailyOrm, BotMetricOrm, InactiveMemberRecordOrm]),
    GatewayModule,
    NewbieModule,
    AuthModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
