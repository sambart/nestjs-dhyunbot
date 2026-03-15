// ─── 타입 정의 ──────────────────────────────────────────────────────────────

/** F-007: 요약 카드 응답 */
export interface CoPresenceSummary {
  activeMemberCount: number;
  totalPairCount: number;
  totalCoPresenceMinutes: number;
  avgPairsPerMember: number;
}

/** F-008: 그래프 노드 */
export interface GraphNode {
  userId: string;
  userName: string;
  totalMinutes: number;
}

/** F-008: 그래프 엣지 */
export interface GraphEdge {
  userA: string;
  userB: string;
  totalMinutes: number;
  sessionCount: number;
}

/** F-008: 그래프 응답 */
export interface CoPresenceGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** F-009: 친밀도 TOP N 쌍의 유저 정보 */
export interface PairUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
}

/** F-009: 친밀도 TOP N 항목 */
export interface TopPair {
  userA: PairUser;
  userB: PairUser;
  totalMinutes: number;
  sessionCount: number;
}

/** F-010: 고립 멤버 */
export interface IsolatedMember {
  userId: string;
  userName: string;
  totalVoiceMinutes: number;
  lastVoiceDate: string;
}

/** F-011: 관계 테이블 쌍 항목 */
export interface PairItem {
  userA: { userId: string; userName: string };
  userB: { userId: string; userName: string };
  totalMinutes: number;
  sessionCount: number;
  lastDate: string;
}

/** F-011: 관계 테이블 페이지네이션 응답 */
export interface PairsResponse {
  total: number;
  page: number;
  limit: number;
  items: PairItem[];
}

/** F-011: 관계 테이블 조회 파라미터 */
export interface FetchPairsParams {
  guildId: string;
  days: number;
  search: string;
  page: number;
  limit: number;
  sortBy: 'totalMinutes' | 'sessionCount' | 'lastDate';
  sortOrder: 'DESC' | 'ASC';
}

/** F-013: 쌍 상세 조회 파라미터 */
export interface FetchPairDetailParams {
  guildId: string;
  userA: string;
  userB: string;
  days: number;
}

/** F-012: 일별 추이 데이터 */
export interface DailyTrendPoint {
  date: string;
  totalMinutes: number;
}

/** F-013: 쌍 상세 모달 응답 */
export interface PairDetail {
  userA: { userId: string; userName: string };
  userB: { userId: string; userName: string };
  totalMinutes: number;
  dailyData: { date: string; minutes: number }[];
}

// ─── API 함수 ────────────────────────────────────────────────────────────────

import { apiClient } from './api-client';
export { formatMinutes, formatShortDate } from './format-utils';

/** F-007: 관계 분석 요약 카드 데이터 조회 */
export async function fetchCoPresenceSummary(
  guildId: string,
  days: number,
): Promise<CoPresenceSummary> {
  return apiClient<CoPresenceSummary>(`/api/guilds/${guildId}/co-presence/summary?days=${days}`);
}

/** F-008: 네트워크 그래프 데이터 조회 */
export async function fetchCoPresenceGraph(
  guildId: string,
  days: number,
  minMinutes: number,
): Promise<CoPresenceGraphData> {
  return apiClient<CoPresenceGraphData>(
    `/api/guilds/${guildId}/co-presence/graph?days=${days}&minMinutes=${minMinutes}`,
  );
}

/** F-009: 친밀도 TOP N 쌍 조회 */
export async function fetchTopPairs(
  guildId: string,
  days: number,
  limit: number,
): Promise<TopPair[]> {
  return apiClient<TopPair[]>(
    `/api/guilds/${guildId}/co-presence/top-pairs?days=${days}&limit=${limit}`,
  );
}

/** F-010: 고립 멤버 목록 조회 */
export async function fetchIsolatedMembers(
  guildId: string,
  days: number,
): Promise<IsolatedMember[]> {
  return apiClient<IsolatedMember[]>(`/api/guilds/${guildId}/co-presence/isolated?days=${days}`);
}

/** F-011: 관계 상세 테이블 조회 */
export async function fetchPairs({
  guildId,
  days,
  search,
  page,
  limit,
  sortBy,
  sortOrder,
}: FetchPairsParams): Promise<PairsResponse> {
  const params = new URLSearchParams();
  params.set('days', String(days));
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('sortBy', sortBy);
  params.set('sortOrder', sortOrder);
  if (search) params.set('search', search);

  return apiClient<PairsResponse>(`/api/guilds/${guildId}/co-presence/pairs?${params.toString()}`);
}

/** F-012: 일별 동시접속 추이 조회 */
export async function fetchDailyTrend(
  guildId: string,
  days: number,
): Promise<DailyTrendPoint[]> {
  return apiClient<DailyTrendPoint[]>(`/api/guilds/${guildId}/co-presence/daily-trend?days=${days}`);
}

/** F-013: 특정 쌍 일별 상세 조회 */
export async function fetchPairDetail({
  guildId,
  userA,
  userB,
  days,
}: FetchPairDetailParams): Promise<PairDetail> {
  const params = new URLSearchParams();
  params.set('userA', userA);
  params.set('userB', userB);
  params.set('days', String(days));

  return apiClient<PairDetail>(`/api/guilds/${guildId}/co-presence/pair-detail?${params.toString()}`);
}
