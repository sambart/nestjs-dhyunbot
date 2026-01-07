// Shared type definitions

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface VoiceChannelActivity {
  userId: string;
  channelId: string;
  guildId: string;
  joinedAt: Date;
  leftAt?: Date;
  duration?: number;
}

export interface VoiceDailyStats {
  userId: string;
  date: string;
  totalDuration: number;
  channelIds: string[];
}

export interface DiscordConfig {
  token: string;
  clientId: string;
  commandPrefix: string;
}
