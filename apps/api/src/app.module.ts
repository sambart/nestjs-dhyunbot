import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscordModule } from '@discord-nestjs/core';
import { TypeORMConfig } from './config/typeorm.config';
import { DiscordConfig } from './config/discord.config';
import { BaseConfig } from './config/base.config';
import { ChannelModule } from './channel/channel.module';
import { VoiceChannelModule } from './channel/voice/voice-channel.module';
import { MusicModule } from './music/music.module';
import { DiscordEventsModule } from './event/discord-events.module';
import { RedisModule } from './redis/redis.module';
import { VoiceAnalyticsModule } from './gemini/voice-analytics.module';
import { AuthModule } from './auth/auth.module';

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
