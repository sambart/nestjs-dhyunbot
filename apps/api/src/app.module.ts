import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AutoChannelModule } from './channel/auto/auto-channel.module';
import { ChannelModule } from './channel/channel.module';
import { VoiceChannelModule } from './channel/voice/voice-channel.module';
import { BaseConfig } from './config/base.config';
import { DiscordConfig } from './config/discord.config';
import { TypeORMConfig } from './config/typeorm.config';
import { DiscordEventsModule } from './event/discord-events.module';
import { VoiceAnalyticsModule } from './gemini/voice-analytics.module';
import { MusicModule } from './music/music.module';
import { NewbieModule } from './newbie/newbie.module';
import { RedisModule } from './redis/redis.module';
import { StatusPrefixModule } from './status-prefix/status-prefix.module';

@Module({
  imports: [
    ConfigModule.forRoot(BaseConfig),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DiscordModule.forRootAsync(DiscordConfig),
    TypeOrmModule.forRootAsync(TypeORMConfig),
    ChannelModule,
    VoiceChannelModule,
    AutoChannelModule,
    NewbieModule,
    StatusPrefixModule,
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
