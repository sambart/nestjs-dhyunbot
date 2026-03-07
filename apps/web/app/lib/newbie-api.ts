export interface NewbieConfig {
  // 환영인사
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeEmbedTitle: string | null;
  welcomeEmbedDescription: string | null;
  welcomeEmbedColor: string | null;
  welcomeEmbedThumbnailUrl: string | null;

  // 미션
  missionEnabled: boolean;
  missionDurationDays: number | null;
  missionTargetPlaytimeHours: number | null;
  missionNotifyChannelId: string | null;
  missionEmbedTitle: string | null;
  missionEmbedDescription: string | null;
  missionEmbedColor: string | null;
  missionEmbedThumbnailUrl: string | null;

  // 모코코 사냥
  mocoEnabled: boolean;
  mocoRankChannelId: string | null;
  mocoAutoRefreshMinutes: number | null;
  mocoEmbedTitle: string | null;
  mocoEmbedDescription: string | null;
  mocoEmbedColor: string | null;
  mocoEmbedThumbnailUrl: string | null;

  // 신입기간 역할
  roleEnabled: boolean;
  roleDurationDays: number | null;
  newbieRoleId: string | null;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * 현재 서버의 신입 관리 설정을 조회한다.
 * 설정이 없으면 null을 반환한다 (백엔드가 404를 반환하는 경우 처리).
 */
export async function fetchNewbieConfig(
  guildId: string,
): Promise<NewbieConfig | null> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/config`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch newbie config: ${res.status}`);
  return res.json() as Promise<NewbieConfig>;
}

/**
 * 신입 관리 설정을 저장한다.
 * 4개 탭 설정을 하나의 DTO로 일괄 전송한다.
 */
export async function saveNewbieConfig(
  guildId: string,
  config: NewbieConfig,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to save newbie config: ${res.status}`);
}
