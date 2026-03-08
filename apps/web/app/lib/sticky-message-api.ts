// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** GET /api/guilds/{guildId}/sticky-message 응답 항목 */
export interface StickyMessageConfig {
  id: number;
  channelId: string;
  channelName?: string;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  messageId: string | null;
  enabled: boolean;
  sortOrder: number;
}

/** POST /api/guilds/{guildId}/sticky-message 요청 바디 */
export interface StickyMessageSaveDto {
  /** null이면 신규 생성, 양의 정수이면 수정 */
  id: number | null;
  channelId: string;
  embedTitle: string | null;
  embedDescription: string | null;
  embedColor: string | null;
  enabled: boolean;
  sortOrder: number;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * 길드의 고정메세지 설정 목록을 조회한다.
 * 설정이 없으면 빈 배열을 반환한다 (sortOrder 오름차순).
 */
export async function fetchStickyMessages(
  guildId: string,
): Promise<StickyMessageConfig[]> {
  const res = await fetch(`/api/guilds/${guildId}/sticky-message`);
  if (!res.ok) throw new Error(`고정메세지 목록 조회 실패: ${res.status}`);
  return res.json() as Promise<StickyMessageConfig[]>;
}

/**
 * 고정메세지 설정을 저장한다 (신규/수정 upsert).
 * 성공 시 저장된 StickyMessageConfig를 반환한다.
 * 실패 시 Error를 throw한다 (채널 없음, 권한 부족 등 백엔드 오류 메시지 포함).
 */
export async function saveStickyMessage(
  guildId: string,
  data: StickyMessageSaveDto,
): Promise<StickyMessageConfig> {
  const res = await fetch(`/api/guilds/${guildId}/sticky-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = `고정메세지 저장 실패: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // 파싱 실패 시 기본 메시지 사용
    }
    throw new Error(message);
  }
  return res.json() as Promise<StickyMessageConfig>;
}

/**
 * 고정메세지 설정을 삭제한다.
 * 백엔드에서 Discord 채널의 메시지도 함께 삭제한다.
 * 실패 시 Error를 throw한다.
 */
export async function deleteStickyMessage(
  guildId: string,
  id: number,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/sticky-message/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`고정메세지 삭제 실패: ${res.status}`);
}
