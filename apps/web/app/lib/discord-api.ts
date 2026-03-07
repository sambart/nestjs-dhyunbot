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

export async function fetchGuildChannels(
  guildId: string,
  refresh = false,
): Promise<DiscordChannel[]> {
  try {
    const url = `/api/guilds/${guildId}/channels${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<DiscordChannel[]>;
  } catch {
    return [];
  }
}

export async function fetchGuildTextChannels(
  guildId: string,
  refresh = false,
): Promise<DiscordChannel[]> {
  const all = await fetchGuildChannels(guildId, refresh);
  return all.filter((ch) => ch.type === 0);
}

export async function fetchGuildRoles(
  guildId: string,
  refresh = false,
): Promise<DiscordRole[]> {
  try {
    const url = `/api/guilds/${guildId}/roles${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<DiscordRole[]>;
  } catch {
    return [];
  }
}
