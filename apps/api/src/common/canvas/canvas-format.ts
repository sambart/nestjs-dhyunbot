/**
 * 초(second) 단위 시간을 사람이 읽기 쉬운 문자열로 변환한다.
 * @param sec - 초 단위 정수
 * @returns 예: 0 → "0분", 90 → "1분", 3700 → "1시간 1분"
 */
export function formatTime(sec: number): string {
  if (sec === 0) return '0분';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

/**
 * 디스코드 닉네임에 자주 쓰이는 특수 유니코드 문자(Mathematical Alphanumeric Symbols 등)를
 * 일반 ASCII/기본 문자로 정규화한다. 폰트에 글리프가 없어 깨지는 문제를 방지한다.
 * @param name - 원본 닉네임 문자열
 * @returns NFKC 정규화된 닉네임
 */
export function normalizeDisplayName(name: string): string {
  return name.normalize('NFKC');
}
