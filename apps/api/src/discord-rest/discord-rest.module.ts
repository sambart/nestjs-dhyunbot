import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DiscordRestService } from './discord-rest.service';

/** Gateway 연결 없이 Discord REST API만 사용하는 글로벌 모듈. */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DiscordRestService],
  exports: [DiscordRestService],
})
export class DiscordRestModule {}
