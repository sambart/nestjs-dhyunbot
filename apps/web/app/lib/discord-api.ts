import { apiGet } from './api-client';

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = GUILD_TEXT, 2 = GUILD_VOICE, 4 = GUILD_CATEGORY
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
}

/** 길드의 전체 채널 목록을 조회한다 */
export async function fetchGuildChannels(
  guildId: string,
  refresh = false,
): Promise<DiscordChannel[]> {
  const qs = refresh ? '?refresh=true' : '';
  return apiGet<DiscordChannel[]>(`/api/guilds/${guildId}/channels${qs}`, []);
}

/** 길드의 텍스트 채널 목록만 필터링하여 조회한다 */
export async function fetchGuildTextChannels(
  guildId: string,
  refresh = false,
): Promise<DiscordChannel[]> {
  const all = await fetchGuildChannels(guildId, refresh);
  return all.filter((ch) => ch.type === 0);
}

/** 길드의 역할 목록을 조회한다 */
export async function fetchGuildRoles(
  guildId: string,
  refresh = false,
): Promise<DiscordRole[]> {
  const qs = refresh ? '?refresh=true' : '';
  return apiGet<DiscordRole[]>(`/api/guilds/${guildId}/roles${qs}`, []);
}

/** 길드의 커스텀 이모지 목록을 조회한다 */
export async function fetchGuildEmojis(
  guildId: string,
  refresh = false,
): Promise<DiscordEmoji[]> {
  const qs = refresh ? '?refresh=true' : '';
  return apiGet<DiscordEmoji[]>(`/api/guilds/${guildId}/emojis${qs}`, []);
}

/** Discord 이모지 CDN URL을 생성한다 */
export function getEmojiCdnUrl(id: string, animated: boolean, size = 32): string {
  const ext = animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=${size}&quality=lossless`;
}

/** Discord 이모지를 메시지용 문자열 포맷으로 변환한다 */
export function formatEmojiString(emoji: DiscordEmoji): string {
  return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}

/** 길드에 등록된 슬래시 커맨드 목록을 조회한다 */
export async function fetchGuildCommands(
  guildId: string,
): Promise<SlashCommand[]> {
  return apiGet<SlashCommand[]>(`/api/guilds/${guildId}/commands`, []);
}
