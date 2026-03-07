import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayIntentBits } from 'discord.js';

import { CommunityHealthCommand } from '../gemini/commands/community-health.command';
import { MyVoiceStatsCommand } from '../gemini/commands/my-voice-stats.command';
import { VoiceLeaderboardCommand } from '../gemini/commands/voice-leaderboard.command';
import { VoiceStatsCommand } from '../gemini/commands/voice-stats.command';
import { MusicPlayCommand } from '../music/music-play.command';
import { MusicSkipCommand } from '../music/music-skip.command';
import { MusicStopCommand } from '../music/music-stop.command';

export const DiscordConfig = {
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    token: configService.get('DISCORD_API_TOKEN'),
    commands: [
      MusicPlayCommand,
      MusicStopCommand,
      MusicSkipCommand,
      VoiceStatsCommand,
      MyVoiceStatsCommand,
      CommunityHealthCommand,
      VoiceLeaderboardCommand,
    ],
    discordClientOptions: {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
