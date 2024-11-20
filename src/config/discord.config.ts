import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayIntentBits } from 'discord.js';

export const DiscordConfig = {
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    token: configService.get('DISCORD_API_TOKEN'),
    discordClientOptions: {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
      ],
    },
    registerCommandOptions: [
      {
        removeCommandsBefore: true,
      },
    ],
    failOnLogin: true,
  }),
  inject: [ConfigService],
};
