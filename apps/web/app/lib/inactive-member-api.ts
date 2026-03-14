// ─── 타입 정의 ──────────────────────────────────────────────────────────────

export type InactiveMemberGrade = 'FULLY_INACTIVE' | 'LOW_ACTIVE' | 'DECLINING';
export type ActionType = 'ACTION_DM' | 'ACTION_ROLE_ADD' | 'ACTION_ROLE_REMOVE' | 'ACTION_KICK';

export interface InactiveMemberItem {
  userId: string;
  nickName: string;
  grade: InactiveMemberGrade;
  totalMinutes: number;
  lastVoiceDate: string | null;
  gradeChangedAt: string | null;
  classifiedAt: string;
}

export interface InactiveMemberListResponse {
  total: number;
  page: number;
  limit: number;
  items: InactiveMemberItem[];
}

export interface InactiveMemberListQuery {
  grade?: InactiveMemberGrade;
  periodDays?: 7 | 14 | 30;
  search?: string;
  sortBy?: 'lastVoiceDate' | 'totalMinutes';
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface InactiveTrendPoint {
  date: string;
  fullyInactive: number;
  lowActive: number;
  declining: number;
}

export interface InactiveMemberStats {
  totalMembers: number;
  activeCount: number;
  fullyInactiveCount: number;
  lowActiveCount: number;
  decliningCount: number;
  returnedCount: number;
  trend: InactiveTrendPoint[];
}

export interface ExecuteActionDto {
  actionType: ActionType;
  targetUserIds: string[];
}

export interface ExecuteActionResponse {
  actionType: ActionType;
  successCount: number;
  failCount: number;
  logId: number;
}

export interface InactiveMemberConfig {
  id: number;
  guildId: string;
  periodDays: 7 | 14 | 30;
  lowActiveThresholdMin: number;
  decliningPercent: number;
  autoActionEnabled: boolean;
  autoRoleAdd: boolean;
  autoDm: boolean;
  inactiveRoleId: string | null;
  removeRoleId: string | null;
  excludedRoleIds: string[];
  dmEmbedTitle: string | null;
  dmEmbedBody: string | null;
  dmEmbedColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InactiveMemberConfigSaveDto = Partial<
  Omit<InactiveMemberConfig, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>
>;

// ─── 유틸 함수 ───────────────────────────────────────────────────────────────

/** totalMinutes → "N시간 M분" 또는 "M분" 형식 */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0분';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

/** 'YYYY-MM-DD' → 'MM/DD' 형식 (차트 X축용) */
export function formatTrendDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  return `${parts[1]}/${parts[2]}`;
}

/** 등급 → 한국어 레이블 */
export function gradeLabel(grade: InactiveMemberGrade): string {
  switch (grade) {
    case 'FULLY_INACTIVE':
      return '완전 비활동';
    case 'LOW_ACTIVE':
      return '저활동';
    case 'DECLINING':
      return '활동 감소';
  }
}

/** 등급 → Badge 색상 클래스 (Tailwind) */
export function gradeBadgeClass(grade: InactiveMemberGrade): string {
  switch (grade) {
    case 'FULLY_INACTIVE':
      return 'bg-red-100 text-red-700';
    case 'LOW_ACTIVE':
      return 'bg-yellow-100 text-yellow-700';
    case 'DECLINING':
      return 'bg-orange-100 text-orange-700';
  }
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/** 비활동 회원 목록 조회 */
export async function fetchInactiveMembers(
  guildId: string,
  query?: InactiveMemberListQuery,
): Promise<InactiveMemberListResponse> {
  const params = new URLSearchParams();
  if (query?.grade) params.set('grade', query.grade);
  if (query?.periodDays !== undefined) params.set('periodDays', String(query.periodDays));
  if (query?.search) params.set('search', query.search);
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query?.page !== undefined) params.set('page', String(query.page));
  if (query?.limit !== undefined) params.set('limit', String(query.limit));

  const qs = params.toString();
  const url = `/api/guilds/${guildId}/inactive-members${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('비활동 회원 목록을 불러오는데 실패했습니다.');
  }
  return res.json() as Promise<InactiveMemberListResponse>;
}

/** 통계 조회 */
export async function fetchInactiveMemberStats(
  guildId: string,
): Promise<InactiveMemberStats> {
  const res = await fetch(`/api/guilds/${guildId}/inactive-members/stats`);
  if (!res.ok) {
    throw new Error('통계 데이터를 불러오는데 실패했습니다.');
  }
  return res.json() as Promise<InactiveMemberStats>;
}

/** 수동 분류 실행 */
export async function classifyInactiveMembers(
  guildId: string,
): Promise<{ classifiedCount: number }> {
  const res = await fetch(`/api/guilds/${guildId}/inactive-members/classify`, {
    method: 'POST',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? '분류 실행에 실패했습니다.');
  }
  return res.json() as Promise<{ classifiedCount: number }>;
}

/** 조치 실행 */
export async function executeInactiveMemberAction(
  guildId: string,
  dto: ExecuteActionDto,
): Promise<ExecuteActionResponse> {
  const res = await fetch(`/api/guilds/${guildId}/inactive-members/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? '조치 실행에 실패했습니다.');
  }
  return res.json() as Promise<ExecuteActionResponse>;
}

/** 설정 조회 */
export async function fetchInactiveMemberConfig(
  guildId: string,
): Promise<InactiveMemberConfig> {
  const res = await fetch(`/api/guilds/${guildId}/inactive-members/config`);
  if (!res.ok) {
    throw new Error('설정을 불러오는데 실패했습니다.');
  }
  return res.json() as Promise<InactiveMemberConfig>;
}

/** 설정 저장 */
export async function saveInactiveMemberConfig(
  guildId: string,
  dto: InactiveMemberConfigSaveDto,
): Promise<InactiveMemberConfig> {
  const res = await fetch(`/api/guilds/${guildId}/inactive-members/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? '설정 저장에 실패했습니다.');
  }
  return res.json() as Promise<InactiveMemberConfig>;
}
