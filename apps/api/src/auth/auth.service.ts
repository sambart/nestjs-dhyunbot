import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const ADMINISTRATOR = 0x8;
const MANAGE_GUILD = 0x20;

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: number;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  createToken(user: {
    discordId: string;
    username: string;
    avatar?: string;
    guilds?: DiscordGuild[];
  }) {
    const managedGuilds = (user.guilds ?? [])
      .filter(
        (g) =>
          g.owner ||
          (g.permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== 0,
      )
      .map(({ id, name, icon }) => ({ id, name, icon }));

    const payload = {
      sub: user.discordId,
      username: user.username,
      avatar: user.avatar,
      guilds: managedGuilds,
    };

    return this.jwtService.sign(payload);
  }
}
