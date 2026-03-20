import { EmbedBuilder } from 'discord.js';
import { describe, expect, it } from 'vitest';

import {
  EMBED_COLOR_PAUSED,
  EMBED_COLOR_PLAYING,
  PROGRESS_BAR_EMPTY,
  PROGRESS_BAR_HEAD,
  PROGRESS_BAR_LENGTH,
} from '../../music.constants';
import { buildNowPlayingEmbed } from './now-playing-embed.builder';

// KazagumoTrack / KazagumoPlayer 타입을 외부 의존성 없이 최소 mock으로 생성
function makeTrack(overrides: {
  title?: string;
  uri?: string | null;
  author?: string | null;
  length?: number;
} = {}) {
  return {
    title: overrides.title ?? '테스트 트랙',
    uri: overrides.uri !== undefined ? overrides.uri : 'https://example.com/track',
    author: overrides.author !== undefined ? overrides.author : '테스트 아티스트',
    length: overrides.length ?? 180_000, // 3분
  };
}

function makePlayer(position: number = 0) {
  return { position };
}

describe('buildNowPlayingEmbed', () => {
  describe('반환값 타입', () => {
    it('EmbedBuilder 인스턴스를 반환한다', () => {
      const track = makeTrack();
      const player = makePlayer();
      const embed = buildNowPlayingEmbed({ track: track as never, player: player as never, status: 'playing' });
      expect(embed).toBeInstanceOf(EmbedBuilder);
    });
  });

  describe('제목 및 URL', () => {
    it('트랙 제목이 Embed 제목으로 설정된다', () => {
      const track = makeTrack({ title: '봄날' });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer() as never, status: 'playing' });
      expect(embed.data.title).toBe('봄날');
    });

    it('트랙 URI가 Embed URL로 설정된다', () => {
      const track = makeTrack({ uri: 'https://youtu.be/abc123' });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer() as never, status: 'playing' });
      expect(embed.data.url).toBe('https://youtu.be/abc123');
    });

    it('URI가 null이면 Embed URL이 설정되지 않는다', () => {
      // Discord.js EmbedBuilder.setURL(null) 동작: data.url을 undefined로 처리
      const track = makeTrack({ uri: null });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer() as never, status: 'playing' });
      expect(embed.data.url).toBeUndefined();
    });
  });

  describe('색상', () => {
    it('status가 playing이면 EMBED_COLOR_PLAYING 색상이 설정된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'playing' });
      expect(embed.data.color).toBe(EMBED_COLOR_PLAYING);
    });

    it('status가 paused이면 EMBED_COLOR_PAUSED 색상이 설정된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'paused' });
      expect(embed.data.color).toBe(EMBED_COLOR_PAUSED);
    });

    it('status가 queued이면 EMBED_COLOR_PAUSED 색상이 설정된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'queued' });
      expect(embed.data.color).toBe(EMBED_COLOR_PAUSED);
    });
  });

  describe('필드: 아티스트', () => {
    it('author가 있으면 아티스트 필드에 표시된다', () => {
      const track = makeTrack({ author: 'BTS' });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '아티스트');
      expect(field?.value).toBe('BTS');
    });

    it('author가 null이면 아티스트 필드에 Unknown이 표시된다', () => {
      const track = makeTrack({ author: null });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '아티스트');
      expect(field?.value).toBe('Unknown');
    });

    it('아티스트 필드는 inline: true이다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '아티스트');
      expect(field?.inline).toBe(true);
    });
  });

  describe('필드: 상태', () => {
    it('status가 playing이면 상태 필드에 "재생 중"이 표시된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '상태');
      expect(field?.value).toBe('재생 중');
    });

    it('status가 paused이면 상태 필드에 "일시정지"가 표시된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'paused' });
      const field = embed.data.fields?.find((f) => f.name === '상태');
      expect(field?.value).toBe('일시정지');
    });

    it('status가 queued이면 상태 필드에 "큐 대기"가 표시된다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'queued' });
      const field = embed.data.fields?.find((f) => f.name === '상태');
      expect(field?.value).toBe('큐 대기');
    });

    it('상태 필드는 inline: true이다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '상태');
      expect(field?.inline).toBe(true);
    });
  });

  describe('필드: 진행', () => {
    it('진행 필드에 진행바와 시간 문자열이 포함된다', () => {
      const track = makeTrack({ length: 180_000 });
      const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer(60_000) as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '진행');
      expect(field?.value).toContain('[');
      expect(field?.value).toContain(']');
      expect(field?.value).toContain('/');
    });

    it('진행 필드는 inline이 아니다', () => {
      const embed = buildNowPlayingEmbed({ track: makeTrack() as never, player: makePlayer() as never, status: 'playing' });
      const field = embed.data.fields?.find((f) => f.name === '진행');
      expect(field?.inline).toBeFalsy();
    });
  });
});

describe('formatTime (내부 함수 — buildNowPlayingEmbed 통해 검증)', () => {
  function extractTimeString(positionMs: number, durationMs: number): string {
    const track = makeTrack({ length: durationMs });
    const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer(positionMs) as never, status: 'playing' });
    const field = embed.data.fields?.find((f) => f.name === '진행');
    // "`[progressBar]`\ntimeString" 에서 시간 문자열 추출
    const lines = field?.value.split('\n') ?? [];
    return lines[1] ?? '';
  }

  it('0ms는 0:00 / 0:00으로 포맷된다', () => {
    const timeStr = extractTimeString(0, 0);
    expect(timeStr).toBe('0:00 / 0:00');
  });

  it('83000ms (1분 23초)는 1:23으로 포맷된다', () => {
    const timeStr = extractTimeString(83_000, 83_000);
    expect(timeStr).toBe('1:23 / 1:23');
  });

  it('3661000ms (1시간 1분 1초)는 H:MM:SS 형식으로 포맷된다', () => {
    const timeStr = extractTimeString(3_661_000, 3_661_000);
    expect(timeStr).toBe('1:01:01 / 1:01:01');
  });

  it('59초는 0:59로 포맷된다', () => {
    const timeStr = extractTimeString(59_000, 59_000);
    expect(timeStr).toBe('0:59 / 0:59');
  });

  it('초가 한 자리면 0으로 패딩된다 (예: 3600000ms = 1:00:00)', () => {
    const timeStr = extractTimeString(3_600_000, 3_600_000);
    expect(timeStr).toBe('1:00:00 / 1:00:00');
  });
});

describe('formatProgressBar (내부 함수 — buildNowPlayingEmbed 통해 검증)', () => {
  function extractProgressBar(positionMs: number, durationMs: number): string {
    const track = makeTrack({ length: durationMs });
    const embed = buildNowPlayingEmbed({ track: track as never, player: makePlayer(positionMs) as never, status: 'playing' });
    const field = embed.data.fields?.find((f) => f.name === '진행');
    // "`[progressBar]`\ntimeString" — 진행바 안쪽 추출
    const raw = field?.value ?? '';
    const match = raw.match(/`\[(.+?)\]`/);
    return match?.[1] ?? '';
  }

  it('duration이 0이면 PROGRESS_BAR_LENGTH만큼 빈 칸으로 채워진다', () => {
    const bar = extractProgressBar(0, 0);
    expect(bar).toBe(PROGRESS_BAR_EMPTY.repeat(PROGRESS_BAR_LENGTH));
    expect(bar.length).toBe(PROGRESS_BAR_LENGTH);
  });

  it('시작 위치(0%)에서는 헤드(>)가 가장 앞에 있다', () => {
    const bar = extractProgressBar(0, 180_000);
    // filledCount = 0, head at index 0
    expect(bar[0]).toBe(PROGRESS_BAR_HEAD);
    expect(bar.length).toBe(PROGRESS_BAR_LENGTH);
  });

  it('50% 위치에서는 진행바 중간에 헤드가 위치한다', () => {
    const bar = extractProgressBar(90_000, 180_000);
    // filledCount = floor(0.5 * 20) = 10, head at index 10
    const headIndex = bar.indexOf(PROGRESS_BAR_HEAD);
    expect(headIndex).toBe(10);
    expect(bar.length).toBe(PROGRESS_BAR_LENGTH);
  });

  it('100% 위치에서는 헤드가 마지막에 위치한다', () => {
    const bar = extractProgressBar(180_000, 180_000);
    // filledCount = floor(1.0 * 20) = 20이지만 emptyCount = -1 → max(emptyCount, 0) = 0
    // 결과: filled(19) + head(1) + empty(0) = 20
    // ratio=1.0 → filledCount = floor(1 * 20) = 20
    // emptyCount = 20 - 20 - 1 = -1 → max(-1, 0) = 0
    // 실제: '='.repeat(20) + '>' + ' '.repeat(0) = 길이 21? 체크 필요
    // 계획서 코드: filledCount=20, emptyCount=-1 → '='.repeat(20) + '>' = 21자
    // 하지만 20칸을 유지하려면 클램프가 필요함. 구현 코드 그대로 반영해야 한다면 길이 21이 된다.
    // 문서(PRD): "20칸 기준"
    // 구현: ratio=1일 때 filledCount=20, emptyCount=-1, max(-1,0)=0 → '='.repeat(20)+'>' 길이21
    // 이것은 구현 결함 가능성 — 테스트로 기록
    expect(bar.length).toBe(PROGRESS_BAR_LENGTH); // PRD: 20칸
    expect(bar[bar.length - 1]).toBe(PROGRESS_BAR_HEAD);
  });

  it('position이 duration보다 크면 100%로 처리된다', () => {
    const bar = extractProgressBar(200_000, 180_000);
    // ratio = min(200000/180000, 1) = 1.0
    expect(bar.length).toBe(PROGRESS_BAR_LENGTH); // PRD: 20칸
  });
});
