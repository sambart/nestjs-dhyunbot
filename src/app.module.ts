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
import { Logger } from '@nestjs/common';
import { VoiceChannelModule } from './voice-channel/voice-channel.module';
import { Member } from './member/member.entity';
import { VoiceChannelHistory } from './voice-channel/voice-channel-history.entity';
import { Channel } from './channel/channel.entity';
import { MusicModule } from './music/music.module';
import { GraphQLModule } from '@nestjs/graphql';
import { GraphQLConfig } from './config/graphql.config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    ConfigModule.forRoot(BaseConfig),
    DiscordModule.forRootAsync(DiscordConfig),
    TypeOrmModule.forRootAsync(TypeORMConfig),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver, // Apollo 드라이버 설정
      autoSchemaFile: true, // 스키마 자동 생성
    }),
    ChannelModule,
    VoiceChannelModule,
    MusicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private configService: ConfigService) {
    // 환경 변수 확인
    //const data = this.configService.get('DATABASE_USER');
    //Logger.log(`DATABASE_USER: ${data}`);
  }
}
