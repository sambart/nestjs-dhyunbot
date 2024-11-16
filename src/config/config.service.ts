import { Injectable } from '@nestjs/common';
import { config } from 'dotenv';

import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Logger } from '@nestjs/common';

@Injectable()
export class ConfigService {
  public readonly port: number;
  public readonly mongoURL: string;

  public readonly discordToken: string;
  public readonly discordClientId: string;

  public readonly adminPrefix: string;
  public readonly defaultPrefix: string;

  public readonly dbConfig: TypeOrmModuleOptions;

  constructor() {
    config();
    this.port = parseInt(process.env.PORT) || 5000;
    this.discordToken = process.env.DISCORD_API_TOKEN || '';
    this.discordClientId = process.env.DISCORD_CLIENT_ID || '';
    this.adminPrefix = process.env.ADMIN_PREIFX || 'admin';
    this.defaultPrefix = process.env.DEFAULT_PREFIX || '!';

    this.dbConfig = {
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT, 5432),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: true, // 개발 환경에서만 사용
    };
    Logger.log(this.dbConfig);
  }

  getBotInviteLink(permissions = '1075305537'): string {
    return `https://discordapp.com/oauth2/authorize?client_id=${this.discordClientId}&scope=bot&permissions=${permissions}`;
  }
}
