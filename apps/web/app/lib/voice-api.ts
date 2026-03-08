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
  try {
    const res = await fetch(`/api/guilds/${guildId}/voice/excluded-channels`);
    if (!res.ok) return [];
    const body = (await res.json()) as VoiceExcludedChannelItem[];
    return body.map((item) => item.discordChannelId);
  } catch {
    return [];
  }
}

/**
 * 제외 채널 목록 저장 — 전체 교체 방식 (PUT).
 * 실패 시 Error throw.
 */
export async function saveVoiceExcludedChannels(
  guildId: string,
  channels: ExcludedChannelEntry[],
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/voice/excluded-channels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels }),
  });
  if (!res.ok) {
    let message = `음성 설정 저장 실패: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // 파싱 실패 시 기본 메시지 사용
    }
    throw new Error(message);
  }
}
