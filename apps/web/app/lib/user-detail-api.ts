import { type VoiceDailyRecord } from './voice-dashboard-api';

// ─── 타입 정의 ──────────────────────────────────────────────────────────────

// F-VOICE-019 응답 타입
export interface MemberSearchResult {
  userId: string;
  userName: string;
}

// F-VOICE-020 응답 아이템 타입
export interface VoiceHistoryItem {
  id: number;
  channelId: string;
  channelName: string;
  categoryId: string | null;
  categoryName: string | null;
  joinAt: string; // ISO 8601
  leftAt: string | null; // null = 접속 중
  durationSec: number | null;
}

// F-VOICE-020 응답 페이지 타입
export interface VoiceHistoryPage {
  total: number;
  page: number;
  limit: number;
  items: VoiceHistoryItem[];
}

// 유저 프로필 응답 타입
export interface MemberProfile {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

/**
 * F-VOICE-019: 멤버 닉네임/ID 검색
 */
export async function searchMembers(
  guildId: string,
  query: string,
): Promise<MemberSearchResult[]> {
  const res = await fetch(
    `/api/guilds/${guildId}/members/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

/**
 * 유저 프로필 조회 (닉네임 + 아바타)
 */
export async function fetchMemberProfile(
  guildId: string,
  userId: string,
): Promise<MemberProfile | null> {
  const res = await fetch(
    `/api/guilds/${guildId}/members/${encodeURIComponent(userId)}/profile`,
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * 유저 프로필 일괄 조회 (아바타 + 닉네임, 최대 50명)
 */
export async function fetchMemberProfiles(
  guildId: string,
  userIds: string[],
): Promise<Record<string, { userName: string; avatarUrl: string | null }>> {
  if (userIds.length === 0) return {};
  const res = await fetch(
    `/api/guilds/${guildId}/members/profiles?ids=${userIds.join(",")}`,
  );
  if (!res.ok) return {};
  return res.json();
}

/**
 * F-VOICE-018: 유저별 음성 일별 통계 (userId 파라미터 추가)
 */
export async function fetchUserVoiceDaily(
  guildId: string,
  userId: string,
  from: string,
  to: string,
): Promise<VoiceDailyRecord[]> {
  const res = await fetch(
    `/api/guilds/${guildId}/voice/daily?userId=${encodeURIComponent(userId)}&from=${from}&to=${to}`,
  );
  if (!res.ok) return [];
  return res.json();
}

/**
 * F-VOICE-020: 유저 입퇴장 이력 페이지네이션
 */
export async function fetchUserVoiceHistory(
  guildId: string,
  userId: string,
  params: { from?: string; to?: string; page?: number; limit?: number },
): Promise<VoiceHistoryPage> {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.page !== undefined)
    searchParams.set("page", String(params.page));
  if (params.limit !== undefined)
    searchParams.set("limit", String(params.limit));

  const res = await fetch(
    `/api/guilds/${guildId}/voice/history/${encodeURIComponent(userId)}?${searchParams.toString()}`,
  );
  if (!res.ok) {
    return { total: 0, page: 1, limit: 20, items: [] };
  }
  return res.json();
}
