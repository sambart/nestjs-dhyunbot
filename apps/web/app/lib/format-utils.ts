/**
 * 로케일 기반 시간/분 포맷 유틸리티.
 * useTranslations hook을 사용할 수 없는 유틸 함수에서
 * 번역 함수(t)를 파라미터로 받아 로컬라이징된 문자열을 반환한다.
 *
 * 사용 예:
 *   const t = useTranslations('common');
 *   formatMinutesI18n(90, t) → "1시간 30분" (ko) / "1h 30m" (en)
 */

type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** 분 → 로컬라이징된 "X시간 Y분" 형식 */
export function formatMinutesI18n(totalMinutes: number, t: TFunc): string {
  if (totalMinutes <= 0) return t('time.minutes', { minutes: 0 });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return t('time.minutes', { minutes });
  if (minutes === 0) return t('time.hours', { hours });
  return t('time.hoursMinutes', { hours, minutes });
}

/** 초 → 로컬라이징된 "X시간 Y분" 형식 */
export function formatDurationSecI18n(totalSec: number, t: TFunc): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return t('time.hoursMinutes', { hours, minutes });
  return t('time.minutes', { minutes });
}

/** 밀리초 → 로컬라이징된 "N일 M시간 P분" 형식 (업타임용) */
export function formatUptimeI18n(ms: number, t: TFunc): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(t('time.days', { days }));
  if (hours > 0) parts.push(t('time.hours', { hours }));
  parts.push(t('time.minutes', { minutes }));
  return parts.join(' ');
}

/** 비활동 등급 enum → 로컬라이징된 레이블 */
export function gradeLabelI18n(
  grade: 'FULLY_INACTIVE' | 'LOW_ACTIVE' | 'DECLINING',
  t: TFunc,
): string {
  const map: Record<string, string> = {
    FULLY_INACTIVE: t('fullyInactive'),
    LOW_ACTIVE: t('lowActive'),
    DECLINING: t('declining'),
  };
  return map[grade] ?? grade;
}
