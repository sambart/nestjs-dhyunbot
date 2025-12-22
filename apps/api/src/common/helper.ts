import { formatInTimeZone } from 'date-fns-tz';

export const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
export function getKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}
