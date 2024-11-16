import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscordModule } from './discord/discord.module';
import { ConfigService } from './config/config.service';
import { ConfigModule } from './config/config.module';

const config = new ConfigService();
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRoot(config.dbConfig),
    DiscordModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
