// auth/discord.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-discord';

export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor() {
    super({
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_CALLBACK_URL,
      scope: ['identify', 'guilds'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      discordId: profile.id,
      username: profile.username,
      avatar: profile.avatar,
      guilds: profile.guilds,
    };
  }
}
