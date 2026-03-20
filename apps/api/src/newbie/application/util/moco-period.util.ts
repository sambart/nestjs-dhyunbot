/**
 * 모코코 리셋 기간 계산 유틸.
 * MocoResetScheduler ↔ MocoService 순환 참조를 방지하기 위해 분리.
 */
export function getMocoPeriodBounds(config: {
  mocoResetPeriod?: string | null;
  mocoCurrentPeriodStart?: string | null;
  mocoResetIntervalDays?: number | null;
}): { periodStart: string; periodEnd: string } | null {
  if (!config.mocoResetPeriod || config.mocoResetPeriod === 'NONE') return null;

  const startStr = config.mocoCurrentPeriodStart;
  if (!startStr) return null;

  const formatDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const year = parseInt(startStr.slice(0, 4), 10);
  const month = parseInt(startStr.slice(4, 6), 10) - 1;
  const day = parseInt(startStr.slice(6, 8), 10);
  const start = new Date(year, month, day);

  if (config.mocoResetPeriod === 'MONTHLY') {
    const endOfMonth = new Date(year, month + 1, 0); // last day of month
    return { periodStart: formatDate(start), periodEnd: formatDate(endOfMonth) };
  }

  if (config.mocoResetPeriod === 'CUSTOM' && config.mocoResetIntervalDays) {
    const end = new Date(start.getTime() + (config.mocoResetIntervalDays - 1) * 86_400_000);
    return { periodStart: formatDate(start), periodEnd: formatDate(end) };
  }

  return null;
}
