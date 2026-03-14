// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export interface VoiceHealthConfig {
  isEnabled: boolean;
  analysisDays: number;
  isCooldownEnabled: boolean;
  cooldownHours: number;
  isLlmSummaryEnabled: boolean;
  minActivityMinutes: number;
  minActiveDaysRatio: number;
  hhiThreshold: number;
  minPeerCount: number;
  badgeActivityTopPercent: number;
  badgeSocialHhiMax: number;
  badgeSocialMinPeers: number;
  badgeHunterTopPercent: number;
  badgeConsistentMinRatio: number;
  badgeMicMinRate: number;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/** 자가진단 설정 조회 */
export async function fetchVoiceHealthConfig(
  guildId: string,
): Promise<VoiceHealthConfig> {
  const res = await fetch(`/api/guilds/${guildId}/voice-health/config`);
  if (!res.ok) throw new Error('설정 조회에 실패했습니다.');
  return res.json() as Promise<VoiceHealthConfig>;
}

/** 자가진단 설정 저장 */
export async function saveVoiceHealthConfig(
  guildId: string,
  config: VoiceHealthConfig,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/voice-health/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('설정 저장에 실패했습니다.');
}
