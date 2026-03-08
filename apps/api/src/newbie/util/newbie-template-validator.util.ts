/**
 * 템플릿 문자열에서 {xxx} 패턴을 모두 추출하여,
 * allowedVars에 포함되지 않는 변수 목록을 반환한다.
 * 반환값이 빈 배열이면 유효.
 */
export function findInvalidVars(template: string, allowedVars: readonly string[]): string[] {
  const found = template.match(/\{[^}]+\}/g) ?? [];
  const allowedSet = new Set(allowedVars);
  return found.filter((v) => !allowedSet.has(v));
}
