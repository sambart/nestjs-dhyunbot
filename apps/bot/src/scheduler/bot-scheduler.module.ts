import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { BotCoPresenceScheduler } from './bot-co-presence.scheduler';
import { BotMonitoringScheduler } from './bot-monitoring.scheduler';

@Module({
  imports: [DiscordModule.forFeature()],
  providers: [BotCoPresenceScheduler, BotMonitoringScheduler],
})
export class BotSchedulerModule {}
