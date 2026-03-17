import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { DiscordRestService } from '../../discord-rest/discord-rest.service';

// TODO(claude 2026-03-17): Gateway 상태 확인은 Bot API 엔드포인트로 전환 필요.
// 현재는 REST 서비스 초기화 여부로 판단한다.

@Injectable()
export class DiscordHealthIndicator extends HealthIndicator {
  constructor(private readonly discordRest: DiscordRestService) {
    super();
  }

  isHealthy(key: string): HealthIndicatorResult {
    // REST 서비스가 초기화되어 botUserId가 있으면 정상
    const botId = this.discordRest.getBotUserId();
    if (botId) {
      return this.getStatus(key, true, { botUserId: botId });
    }

    return this.getStatus(key, false, { status: 'REST service not initialized' });
  }
}
