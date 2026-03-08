export const StatusPrefixKeys = {
  /**
   * 원래 닉네임 저장: status_prefix:original:{guildId}:{memberId}
   * TTL 없음 (퇴장 시 또는 RESET 버튼 클릭 시 명시적 삭제)
   */
  originalNickname: (guildId: string, memberId: string) =>
    `status_prefix:original:${guildId}:${memberId}`,

  /**
   * 설정 캐시: status_prefix:config:{guildId}
   * TTL 1시간 (설정 저장 시 명시적 갱신)
   */
  config: (guildId: string) => `status_prefix:config:${guildId}`,
} as const;
