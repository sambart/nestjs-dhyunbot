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
  playCountMinDurationMin: number | null;
  playCountIntervalMin: number | null;
  missionNotifyChannelId: string | null;
  missionEmbedColor: string | null;

  // 모코코 사냥
  mocoEnabled: boolean;
  mocoNewbieDays: number | null;
  mocoAllowNewbieHunter: boolean;
  mocoRankChannelId: string | null;
  mocoAutoRefreshMinutes: number | null;
  mocoEmbedColor: string | null;

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

// ─── 미션 템플릿 ─────────────────────────────────────────────────────────────

export interface MissionStatusEntry {
  emoji: string;
  text: string;
}

export interface MissionStatusMapping {
  IN_PROGRESS: MissionStatusEntry;
  COMPLETED: MissionStatusEntry;
  FAILED: MissionStatusEntry;
}

/**
 * NewbieMissionTemplate 테이블 대응 타입.
 * null 필드는 백엔드가 기본값을 사용한다는 의미.
 */
export interface MissionTemplate {
  titleTemplate: string | null;
  headerTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
  statusMapping: MissionStatusMapping | null;
}

export const DEFAULT_MISSION_TEMPLATE: MissionTemplate = {
  titleTemplate: '🧑‍🌾 신입 미션 체크',
  headerTemplate: '🧑‍🌾 뉴비 멤버 (총 인원: {totalCount}명)',
  itemTemplate: '{mention} 🌱\n{startDate} ~ {endDate}\n{statusEmoji} {statusText} | 플레이타임: {playtime} | 플레이횟수: {playCount}회',
  footerTemplate: '마지막 갱신: {updatedAt}',
  statusMapping: {
    IN_PROGRESS: { emoji: '🟡', text: '진행중' },
    COMPLETED: { emoji: '✅', text: '완료' },
    FAILED: { emoji: '❌', text: '실패' },
  },
};

/**
 * 미션 템플릿을 조회한다.
 * 백엔드에 레코드가 없으면 null을 반환하고, 프론트는 DEFAULT_MISSION_TEMPLATE을 표시한다.
 */
export async function fetchMissionTemplate(
  guildId: string,
): Promise<MissionTemplate | null> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/mission-template`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch mission template: ${res.status}`);
  return res.json() as Promise<MissionTemplate>;
}

/**
 * 미션 템플릿을 저장한다.
 * 백엔드 유효성 검사 실패 시 { field, allowedVariables } 구조의 오류 응답이 온다.
 */
export async function saveMissionTemplate(
  guildId: string,
  template: MissionTemplate,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/mission-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Failed to save mission template: ${res.status}`,
    );
  }
}

// ─── 모코코 템플릿 ────────────────────────────────────────────────────────────

/**
 * NewbieMocoTemplate 테이블 대응 타입.
 */
export interface MocoTemplate {
  titleTemplate: string | null;
  bodyTemplate: string | null;
  itemTemplate: string | null;
  footerTemplate: string | null;
}

export const DEFAULT_MOCO_TEMPLATE: MocoTemplate = {
  titleTemplate: '모코코 사냥 TOP {rank} — {hunterName} 🌱',
  bodyTemplate: '총 모코코 사냥 시간: {totalMinutes}분\n\n도움을 받은 모코코들:\n{mocoList}',
  itemTemplate: '– {newbieName} 🌱: {minutes}분',
  footerTemplate: '페이지 {currentPage}/{totalPages} | 자동 갱신 {interval}분',
};

export async function fetchMocoTemplate(
  guildId: string,
): Promise<MocoTemplate | null> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco-template`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch moco template: ${res.status}`);
  return res.json() as Promise<MocoTemplate>;
}

export async function saveMocoTemplate(
  guildId: string,
  template: MocoTemplate,
): Promise<void> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `Failed to save moco template: ${res.status}`,
    );
  }
}
