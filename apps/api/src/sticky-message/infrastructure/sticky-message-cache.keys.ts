export const StickyMessageKeys = {
  /**
   * 설정 캐시: sticky_message:config:{guildId}
   * TTL 1시간 (설정 저장 시 명시적 갱신, 삭제 시 무효화)
   */
  config: (guildId: string) => `sticky_message:config:${guildId}`,

  /**
   * 디바운스 타이머: sticky_message:debounce:{channelId}
   * TTL 3초 (메시지 수신 시 리셋)
   */
  debounce: (channelId: string) => `sticky_message:debounce:${channelId}`,
} as const;
