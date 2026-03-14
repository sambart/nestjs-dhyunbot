export interface PeerTime {
  peerId: string;
  minutes: number;
}

/**
 * HHI (Herfindahl-Hirschman Index)를 계산한다.
 * HHI = SUM(si^2), si = 특정 peer와의 시간 / 전체 시간
 *
 * @returns HHI 값 (0~1). 데이터가 없으면 1 반환 (완전 편중)
 */
export function calculateHhi(peerTimes: PeerTime[]): number {
  if (peerTimes.length === 0) {
    return 1;
  }

  const total = peerTimes.reduce((sum, p) => sum + p.minutes, 0);
  if (total === 0) {
    return 1;
  }

  return peerTimes.reduce((sum, p) => {
    const share = p.minutes / total;
    return sum + share * share;
  }, 0);
}

/**
 * peer별 비율을 계산하고 상위 N명을 반환한다.
 */
export function getTopPeers(
  peerTimes: PeerTime[],
  topN: number,
): Array<{ peerId: string; minutes: number; ratio: number }> {
  const total = peerTimes.reduce((sum, p) => sum + p.minutes, 0);

  return [...peerTimes]
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, topN)
    .map((p) => ({
      peerId: p.peerId,
      minutes: p.minutes,
      ratio: total > 0 ? p.minutes / total : 0,
    }));
}
