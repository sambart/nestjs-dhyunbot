export const VoiceHealthKeys = {
  /** 설정 캐시: voice-health:config:{guildId} — TTL 1시간 */
  config: (guildId: string) => `voice-health:config:${guildId}`,

  /** 자가진단 쿨다운: voice-health:cooldown:{guildId}:{userId} — TTL cooldownHours * 3600 */
  cooldown: (guildId: string, userId: string) => `voice-health:cooldown:${guildId}:${userId}`,
} as const;
