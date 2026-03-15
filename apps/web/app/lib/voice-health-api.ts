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

import { apiClient } from './api-client';

/** 자가진단 설정 조회 */
export async function fetchVoiceHealthConfig(
  guildId: string,
): Promise<VoiceHealthConfig> {
  return apiClient<VoiceHealthConfig>(`/api/guilds/${guildId}/voice-health/config`);
}

/** 자가진단 설정 저장 */
export async function saveVoiceHealthConfig(
  guildId: string,
  config: VoiceHealthConfig,
): Promise<void> {
  await apiClient<void>(`/api/guilds/${guildId}/voice-health/config`, {
    method: 'POST',
    body: config,
  });
}
