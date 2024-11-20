import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ServerConfig } from './config/server.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(ServerConfig.SERVER_PORT ?? 3000, async () => {
    Logger.log(`Server listening on port ${ServerConfig.SERVER_PORT}`);
  });
}
bootstrap();
