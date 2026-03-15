import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { DiscordHealthIndicator } from './indicators/discord.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly discord: DiscordHealthIndicator,
  ) {}

  /** GET /health — 전체 readiness (DB + Redis + Discord) */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.discord.isHealthy('discord'),
    ]);
  }

  /** GET /health/liveness — 프로세스 alive 확인 */
  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }
}
