export const VoiceGameKeys = {
  /** 유저별 현재 게임 세션: voice:game:session:{guildId}:{userId} — TTL 24시간 */
  gameSession: (guildId: string, userId: string) => `voice:game:session:${guildId}:${userId}`,

  /** 모든 게임 세션 SCAN 패턴 */
  gameSessionPattern: () => 'voice:game:session:*',
};
