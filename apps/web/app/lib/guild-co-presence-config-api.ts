import { apiClient } from './api-client';

/** GET /api/guilds/:guildId/co-presence-config 응답 */
export interface GuildCoPresenceConfig {
  guildId: string;
  allowPublicAffinityQuery: boolean;
  updatedAt: string;
}

/** PUT /api/guilds/:guildId/co-presence-config 요청 본문 */
export interface GuildCoPresenceConfigSaveDto {
  allowPublicAffinityQuery: boolean;
}

/**
 * 길드의 Co-Presence 토글 설정을 조회한다.
 * @param guildId 조회할 길드 ID
 */
export async function fetchGuildCoPresenceConfig(guildId: string): Promise<GuildCoPresenceConfig> {
  return apiClient<GuildCoPresenceConfig>(`/api/guilds/${guildId}/co-presence-config`);
}

/**
 * 길드의 Co-Presence 토글 설정을 저장한다.
 * @param guildId 저장할 길드 ID
 * @param dto 저장할 설정 DTO
 */
export async function saveGuildCoPresenceConfig(
  guildId: string,
  dto: GuildCoPresenceConfigSaveDto,
): Promise<GuildCoPresenceConfig> {
  return apiClient<GuildCoPresenceConfig>(`/api/guilds/${guildId}/co-presence-config`, {
    method: 'PUT',
    body: dto,
  });
}
