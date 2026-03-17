import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('BotMain');

  // Bot은 HTTP 서버가 필요 없지만, health check 등을 위해 최소 포트 개방
  const port = process.env.BOT_PORT ?? 3001;
  await app.listen(port);

  logger.log(`Bot process started on port ${port}`);
}

void bootstrap();
