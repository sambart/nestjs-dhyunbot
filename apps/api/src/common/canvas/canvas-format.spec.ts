/**
 * canvas-format.ts 단위 테스트
 * 대상: formatTime
 *
 * 외부 의존성 없음. 순수 함수 테스트.
 */

import { formatTime } from './canvas-format';

describe('formatTime', () => {
  it('0초 → "0분"', () => {
    expect(formatTime(0)).toBe('0분');
  });

  it('90초(1분30초) → "1분" (분 단위로 버림)', () => {
    expect(formatTime(90)).toBe('1분');
  });

  it('3700초(1시간 1분40초) → "1시간 1분"', () => {
    expect(formatTime(3700)).toBe('1시간 1분');
  });

  it('3600초(정확히 1시간) → "1시간 0분"', () => {
    expect(formatTime(3600)).toBe('1시간 0분');
  });

  it('59초 → "0분" (1분 미만은 0분)', () => {
    expect(formatTime(59)).toBe('0분');
  });

  it('60초 → "1분"', () => {
    expect(formatTime(60)).toBe('1분');
  });

  it('7200초(2시간) → "2시간 0분"', () => {
    expect(formatTime(7200)).toBe('2시간 0분');
  });

  it('3661초(1시간 1분 1초) → "1시간 1분"', () => {
    expect(formatTime(3661)).toBe('1시간 1분');
  });

  it('반환 타입이 string이다', () => {
    expect(typeof formatTime(0)).toBe('string');
    expect(typeof formatTime(3600)).toBe('string');
  });
});
