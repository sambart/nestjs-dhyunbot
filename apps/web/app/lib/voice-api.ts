import { apiClient, apiGet } from './api-client';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** GET /api/guilds/{guildId}/voice/excluded-channels 응답 아이템 */
interface VoiceExcludedChannelItem {
  id: number;
  guildId: string;
  discordChannelId: string;
  type: 'CHANNEL' | 'CATEGORY';
}

/** PUT 요청 바디의 채널 항목 */
export interface ExcludedChannelEntry {
  channelId: string;
  type: 'CHANNEL' | 'CATEGORY';
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * 제외 채널 목록 조회 (F-VOICE-013).
 * 백엔드는 엔티티 배열을 반환하므로 discordChannelId를 추출한다.
 * 실패 시 빈 배열 반환 (초기 로드 중단 방지).
 */
export async function fetchVoiceExcludedChannels(
  guildId: string,
): Promise<string[]> {
  const items = await apiGet<VoiceExcludedChannelItem[]>(
    `/api/guilds/${guildId}/voice/excluded-channels`,
    [],
  );
  return items.map((item) => item.discordChannelId);
}

/**
 * 제외 채널 목록 저장 — 전체 교체 방식 (PUT).
 * 실패 시 Error throw.
 */
export async function saveVoiceExcludedChannels(
  guildId: string,
  channels: ExcludedChannelEntry[],
): Promise<void> {
  await apiClient<void>(`/api/guilds/${guildId}/voice/excluded-channels`, {
    method: 'PUT',
    body: { channels },
  });
}
