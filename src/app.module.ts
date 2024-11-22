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

@Module({
  imports: [
    ConfigModule.forRoot(BaseConfig),
    DiscordModule.forRootAsync(DiscordConfig),
    TypeOrmModule.forRootAsync(TypeORMConfig),
    ChannelModule,
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
