/**
 * 템플릿 문자열의 {key} 플레이스홀더를 vars 맵의 값으로 전부 치환한다.
 * 존재하지 않는 키는 그대로 남긴다 (유효성 검사는 별도 유틸에서 수행).
 */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template,
  );
}
