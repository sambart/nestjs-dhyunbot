export const todayYYYYMMDD = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
export function getKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

export function splitMessage(text: string, max: number): string[] {
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    chunks.push(text.slice(i, i + max));
    i += max;
  }

  return chunks;
}
