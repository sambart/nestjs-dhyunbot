import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayIntentBits } from 'discord.js';
import { MusicPlayCommand } from 'src/music/music-play.command';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { MusicStopCommand } from 'src/music/music-stop.command';
import { MusicSkipCommand } from 'src/music/music-skip.command';

export const DiscordConfig = {
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    token: configService.get('DISCORD_API_TOKEN'),
    commands: [MusicPlayCommand, MusicStopCommand, MusicSkipCommand],
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
