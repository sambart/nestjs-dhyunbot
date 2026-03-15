export function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export function getKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

export function getUTCDateString(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

/**
 * 줄 단위로 텍스트를 분할하여 마크다운 구조를 보존한다.
 * 각 청크가 maxLength 이하가 되도록 줄(\n) 경계에서 분할한다.
 */
export function splitByLines(text: string, maxLength: number): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? current + '\n' + line : line;
    if (candidate.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
