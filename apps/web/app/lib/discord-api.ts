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
): Promise<DiscordChannel[]> {
  try {
    const res = await fetch(`/api/guilds/${guildId}/channels`);
    if (!res.ok) return [];
    return res.json() as Promise<DiscordChannel[]>;
  } catch {
    return [];
  }
}

export async function fetchGuildTextChannels(
  guildId: string,
): Promise<DiscordChannel[]> {
  const all = await fetchGuildChannels(guildId);
  return all.filter((ch) => ch.type === 0);
}

export async function fetchGuildRoles(
  guildId: string,
): Promise<DiscordRole[]> {
  try {
    const res = await fetch(`/api/guilds/${guildId}/roles`);
    if (!res.ok) return [];
    return res.json() as Promise<DiscordRole[]>;
  } catch {
    return [];
  }
}
