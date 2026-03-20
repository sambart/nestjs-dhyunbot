import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';
import { DiscordHealthIndicator } from './indicators/discord.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, DiscordHealthIndicator],
})
export class HealthModule {}
