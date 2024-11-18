import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

import { ConfigService } from './config/config.service';
import { DiscordService } from './discord/discord.service';
import { CommandsService } from './commands/commands.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const discordService = app.get(DiscordService);
  const commandService = app.get(CommandsService);

  await app.listen(config.port ?? 3000, async () => {
    Logger.log(`Server listening on port ${config.port}`);
    Logger.log(`Bot invite link: ${config.getBotInviteLink()}`);
    const client = await discordService.connect();
    commandService.register(client);
  });
}
bootstrap();
