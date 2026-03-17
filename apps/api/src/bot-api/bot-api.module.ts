import { Module } from '@nestjs/common';

import { NewbieModule } from '../newbie/newbie.module';
import { BotApiAuthGuard } from './bot-api-auth.guard';
import { BotNewbieController } from './newbie/bot-newbie.controller';
import { BotVoiceController } from './voice/bot-voice.controller';

/**
 * Bot → API 통신을 위한 내부 API 모듈.
 * Bot 프로세스에서 HTTP로 호출하는 엔드포인트를 제공한다.
 */
@Module({
  imports: [NewbieModule],
  controllers: [BotVoiceController, BotNewbieController],
  providers: [BotApiAuthGuard],
  exports: [BotApiAuthGuard],
})
export class BotApiModule {}
