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

export interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
}

export async function fetchGuildEmojis(
  guildId: string,
  refresh = false,
): Promise<DiscordEmoji[]> {
  try {
    const url = `/api/guilds/${guildId}/emojis${refresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<DiscordEmoji[]>;
  } catch {
    return [];
  }
}

export function getEmojiCdnUrl(id: string, animated: boolean, size = 32): string {
  const ext = animated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=${size}&quality=lossless`;
}

export function formatEmojiString(emoji: DiscordEmoji): string {
  return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
}

export async function fetchGuildCommands(
  guildId: string,
): Promise<SlashCommand[]> {
  try {
    const res = await fetch(`/api/guilds/${guildId}/commands`);
    if (!res.ok) return [];
    return res.json() as Promise<SlashCommand[]>;
  } catch {
    return [];
  }
}
