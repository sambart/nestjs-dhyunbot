import type { SKRSContext2D } from '@napi-rs/canvas';

import {
  ACCENT,
  BAR_EMPTY,
  BLURPLE,
  BLURPLE_DIM,
  BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from './canvas-palette';

/** 막대 차트 단일 항목 */
export interface BarChartEntry {
  /** YYYYMMDD 형식 날짜 문자열 */
  date: string;
  /** 해당 날짜의 값 (초 단위 등 렌더러가 정의) */
  value: number;
}

/** `drawBarChart` 파라미터 */
export interface DrawBarChartParams {
  /** 차트 시작 x 좌표 */
  x: number;
  /** 차트 시작 y 좌표 */
  y: number;
  /** 차트 너비 */
  w: number;
  /** 차트 높이 */
  h: number;
  /** 표시할 항목 목록 */
  entries: BarChartEntry[];
  /** 차트 위에 표시할 제목 텍스트 (옵션) */
  title?: string;
}

/** `drawStatCardWithSub` 파라미터 */
export interface DrawStatCardWithSubParams {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: string;
  subText: string;
}

/**
 * Canvas 2D 컨텍스트에 둥근 모서리 직사각형 경로를 그린다.
 * fill() 또는 stroke() 호출로 렌더링해야 한다.
 * @param ctx - Canvas 2D 컨텍스트
 * @param x - 좌상단 x 좌표
 * @param y - 좌상단 y 좌표
 * @param w - 너비
 * @param h - 높이
 * @param r - 모서리 반지름
 */
// Canvas API 표준 시그니처(ctx + 5개 좌표/크기 인자)라 6개 파라미터가 불가피하다
// eslint-disable-next-line max-params
export function roundRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 텍스트가 최대 너비를 초과할 경우 뒤에 "..."을 붙여 잘라낸다.
 * @param ctx - Canvas 2D 컨텍스트 (현재 font 설정 사용)
 * @param name - 원본 문자열
 * @param maxWidth - 허용 최대 픽셀 너비
 * @returns 너비 범위 내에 들어오도록 truncate된 문자열
 */
export function truncateName(ctx: SKRSContext2D, name: string, maxWidth: number): string {
  if (ctx.measureText(name).width <= maxWidth) return name;

  // 뒤에서부터 한 글자씩 제거하며 "..."을 붙였을 때 maxWidth 이하가 되는 지점 탐색
  let truncated = name;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * 라벨·값·보조 텍스트로 구성된 통계 카드를 그린다.
 * 색상은 canvas-palette 상수를 직접 사용한다 (도메인 일관 카드 디자인).
 * @param ctx - Canvas 2D 컨텍스트
 * @param params - 카드 위치, 크기, 텍스트 파라미터
 */
// ── StatCard 내부 레이아웃 상수 ──
const STAT_CARD_RADIUS = 8;
const STAT_CARD_PADDING_X = 14;
const STAT_CARD_LABEL_OFFSET_Y = 24;
const STAT_CARD_VALUE_OFFSET_Y = 54;
const STAT_CARD_SUB_GAP_X = 8;

export function drawStatCardWithSub(ctx: SKRSContext2D, params: DrawStatCardWithSubParams): void {
  const { x, y, w, h, label, value, subText } = params;
  roundRect(ctx, x, y, w, h, STAT_CARD_RADIUS);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = '13px "NotoSansCJK", "NotoColorEmoji", sans-serif';
  ctx.fillText(label, x + STAT_CARD_PADDING_X, y + STAT_CARD_LABEL_OFFSET_Y);

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = 'bold 22px "NotoSansCJK", "NotoColorEmoji", sans-serif';
  ctx.fillText(value, x + STAT_CARD_PADDING_X, y + STAT_CARD_VALUE_OFFSET_Y);

  if (subText) {
    const valueWidth = ctx.measureText(value).width;
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '12px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(
      subText,
      x + STAT_CARD_PADDING_X + valueWidth + STAT_CARD_SUB_GAP_X,
      y + STAT_CARD_VALUE_OFFSET_Y,
    );
  }
}

/**
 * 일별 막대 차트를 그린다. 짝수 인덱스 항목에 날짜 라벨(dd)을 표시한다.
 * 값이 0인 날은 짧은 흐린 바로 표시한다.
 * @param ctx - Canvas 2D 컨텍스트
 * @param params - 차트 위치, 크기, 항목 목록, 제목
 */

// ── BarChart 내부 레이아웃 상수 ──
const BAR_CHART_RADIUS = 8;
const BAR_CHART_TITLE_OFFSET_Y = 8;
const BAR_CHART_SIDE_PADDING = 20;
const BAR_CHART_AREA_SHRINK = 40; // 양쪽 패딩(20*2)
const BAR_GAP = 6;
const BAR_TOP_MARGIN = 50;
const BAR_BOTTOM_MARGIN = 16;
const BAR_MIN_H = 4;
const BAR_RADIUS = 3;
const BAR_LABEL_OFFSET_Y = 12;
const BAR_ZERO_H = 4;

export function drawBarChart(ctx: SKRSContext2D, params: DrawBarChartParams): void {
  const { x, y, w, h, entries, title } = params;

  if (title) {
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = 'bold 14px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(title, x, y - BAR_CHART_TITLE_OFFSET_Y);
  }

  roundRect(ctx, x, y, w, h, BAR_CHART_RADIUS);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const barCount = entries.length;
  const barAreaW = w - BAR_CHART_AREA_SHRINK;
  const barW = (barAreaW - BAR_GAP * (barCount - 1)) / barCount;
  const barMaxH = h - BAR_TOP_MARGIN;
  const baseY = y + h - BAR_BOTTOM_MARGIN;

  entries.forEach((entry, idx) => {
    const barX = x + BAR_CHART_SIDE_PADDING + idx * (barW + BAR_GAP);
    const barH =
      entry.value > 0 ? Math.max((entry.value / maxValue) * barMaxH, BAR_MIN_H) : BAR_MIN_H;

    roundRect(ctx, barX, baseY - barMaxH, barW, barMaxH, BAR_RADIUS);
    ctx.fillStyle = BAR_EMPTY;
    ctx.fill();

    if (entry.value > 0) {
      roundRect(ctx, barX, baseY - barH, barW, barH, BAR_RADIUS);
      ctx.fillStyle = BLURPLE;
      ctx.fill();
    } else {
      // 값이 0인 날은 흐린 짧은 바로 표시해 해당 날짜가 존재함을 알림
      roundRect(ctx, barX, baseY - BAR_ZERO_H, barW, BAR_ZERO_H, BAR_RADIUS);
      ctx.fillStyle = BLURPLE_DIM;
      ctx.fill();
    }

    if (idx % 2 === 0) {
      const dd = entry.date.slice(6, 8);
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '10px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dd, barX + barW / 2, baseY + BAR_LABEL_OFFSET_Y);
      ctx.textAlign = 'left';
    }
  });
}
