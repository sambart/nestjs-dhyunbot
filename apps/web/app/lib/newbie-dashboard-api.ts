/** 모코코 순위 아이템 */
export interface MocoRankItem {
  hunterId: string;
  totalMinutes: number;
  score: number;
  sessionCount: number;
  uniqueNewbieCount: number;
  channelMinutes: number;
}

/** 모코코 순위 응답 */
export interface MocoRankResponse {
  items: MocoRankItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 사냥꾼 상세 — 도움받은 모코코 */
export interface MocoNewbieDetail {
  newbieId: string;
  newbieName: string;
  minutes: number;
  sessions: number;
}

/** 사냥꾼 상세 응답 */
export interface MocoHunterDetailResponse {
  newbies: MocoNewbieDetail[];
}

/**
 * 모코코 사냥 순위 페이지 조회
 */
export async function fetchMocoRanking(
  guildId: string,
  page = 1,
  pageSize = 10,
): Promise<MocoRankResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch moco ranking: ${res.status}`);
  return res.json() as Promise<MocoRankResponse>;
}

/**
 * 사냥꾼 상세 — 도움받은 모코코 목록 조회
 */
export async function fetchMocoHunterDetail(
  guildId: string,
  hunterId: string,
): Promise<MocoHunterDetailResponse> {
  const res = await fetch(`/api/guilds/${guildId}/newbie/moco/${encodeURIComponent(hunterId)}`);
  if (!res.ok) throw new Error(`Failed to fetch moco hunter detail: ${res.status}`);
  return res.json() as Promise<MocoHunterDetailResponse>;
}
