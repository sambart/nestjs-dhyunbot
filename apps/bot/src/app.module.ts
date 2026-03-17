import { BotApiClientModule } from '@dhyunbot/bot-api-client';
import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DiscordConfig } from './config/discord.config';
import { BotEventModule } from './event/bot-event.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DiscordModule.forRootAsync(DiscordConfig),
    BotApiClientModule.forRoot({
      baseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
      apiKey: process.env.BOT_API_KEY ?? '',
    }),
    BotEventModule,
  ],
})
export class AppModule {}
