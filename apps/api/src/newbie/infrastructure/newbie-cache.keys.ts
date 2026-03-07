export const NewbieKeys = {
  /** 설정 캐시: newbie:config:{guildId} — TTL 1시간 */
  config: (guildId: string) => `newbie:config:${guildId}`,

  /** 진행중 미션 목록 캐시: newbie:mission:active:{guildId} — TTL 30분 */
  missionActive: (guildId: string) => `newbie:mission:active:${guildId}`,

  /** 신입기간 활성 멤버 집합: newbie:period:active:{guildId} — TTL 1시간 */
  periodActive: (guildId: string) => `newbie:period:active:${guildId}`,

  /** 사냥꾼별 신규사용자별 사냥 시간 Hash: newbie:moco:total:{guildId}:{hunterId} — TTL 없음 */
  mocoTotal: (guildId: string, hunterId: string) =>
    `newbie:moco:total:${guildId}:${hunterId}`,

  /** 길드별 사냥꾼 순위 Sorted Set: newbie:moco:rank:{guildId} — TTL 없음 */
  mocoRank: (guildId: string) => `newbie:moco:rank:${guildId}`,
} as const;
