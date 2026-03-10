import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { MonitoringScheduler } from './application/monitoring.scheduler';
import { MonitoringService } from './application/monitoring.service';
import { BotMetric } from './domain/bot-metric.entity';
import { BotMetricRepository } from './infrastructure/bot-metric.repository';
import { MonitoringController } from './presentation/monitoring.controller';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([BotMetric]),
    AuthModule,
    RedisModule,
  ],
  controllers: [MonitoringController],
  providers: [BotMetricRepository, MonitoringService, MonitoringScheduler],
})
export class MonitoringModule {}
