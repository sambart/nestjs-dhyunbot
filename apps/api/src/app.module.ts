import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChannelModule } from './channel/channel.module';
import { VoiceChannelModule } from './channel/voice/voice-channel.module';
import { BaseConfig } from './config/base.config';
import { DiscordConfig } from './config/discord.config';
import { TypeORMConfig } from './config/typeorm.config';
import { DiscordEventsModule } from './event/discord-events.module';
import { VoiceAnalyticsModule } from './gemini/voice-analytics.module';
import { MusicModule } from './music/music.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot(BaseConfig),
    DiscordModule.forRootAsync(DiscordConfig),
    TypeOrmModule.forRootAsync(TypeORMConfig),
    ChannelModule,
    VoiceChannelModule,
    MusicModule,
    DiscordEventsModule,
    RedisModule,
    VoiceAnalyticsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
