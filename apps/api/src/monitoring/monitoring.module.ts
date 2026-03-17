import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { MonitoringScheduler } from './application/monitoring.scheduler';
import { MonitoringService } from './application/monitoring.service';
import { BotMetricOrm } from './infrastructure/bot-metric.orm-entity';
import { BotMetricRepository } from './infrastructure/bot-metric.repository';
import { MonitoringController } from './presentation/monitoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotMetricOrm]),
    AuthModule,
    RedisModule,
  ],
  controllers: [MonitoringController],
  providers: [BotMetricRepository, MonitoringService, MonitoringScheduler],
})
export class MonitoringModule {}
