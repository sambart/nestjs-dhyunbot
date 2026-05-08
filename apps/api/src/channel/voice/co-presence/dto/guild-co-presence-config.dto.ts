import { IsBoolean } from 'class-validator';

/** 웹 API `PUT /api/guilds/:guildId/co-presence-config` 요청 본문 DTO */
export class UpdateGuildCoPresenceConfigDto {
  @IsBoolean()
  allowPublicAffinityQuery: boolean;
}

/** 웹 API `GET/PUT /api/guilds/:guildId/co-presence-config` 응답 DTO */
export class GuildCoPresenceConfigDto {
  guildId: string;
  allowPublicAffinityQuery: boolean;
  updatedAt: string;
}
