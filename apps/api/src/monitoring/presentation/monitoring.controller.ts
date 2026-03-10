import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import {
  BotStatusResponse,
  MetricsResponse,
  MonitoringService,
} from '../application/monitoring.service';

@Controller('api/guilds/:guildId/bot')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  /**
   * GET /api/guilds/:guildId/bot/status
   * 실시간 봇 상태 조회 (F-MONITORING-001)
   */
  @Get('status')
  async getStatus(
    @Param('guildId') guildId: string,
  ): Promise<BotStatusResponse> {
    return this.monitoringService.getStatus(guildId);
  }

  /**
   * GET /api/guilds/:guildId/bot/metrics
   * 시계열 메트릭 조회 (F-MONITORING-003)
   */
  @Get('metrics')
  async getMetrics(
    @Param('guildId') guildId: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
    @Query('interval') interval?: string,
  ): Promise<MetricsResponse> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(to.getTime() - 24 * 60 * 60 * 1000);

    const validIntervals = ['1m', '5m', '1h', '1d'];
    const resolvedInterval = validIntervals.includes(interval ?? '')
      ? interval!
      : '1m';

    return this.monitoringService.getMetrics(
      guildId,
      from,
      to,
      resolvedInterval,
    );
  }
}
