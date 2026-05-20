import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';

import {
  BG,
  BLURPLE,
  BORDER,
  CanvasFontsService,
  CARD_BG,
  DIVIDER,
  drawBarChart,
  drawStatCardWithSub,
  normalizeDisplayName,
  roundRect,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  truncateName,
} from '../../../../common/canvas';
import type { AffinityCardData } from './best-friend-card.types';

// ── 레이아웃 상수 ──
const CARD_W = 800;
const CARD_H = 380;
const PADDING = 32;
const CARD_RADIUS = 16;
const HEADER_H = 110;
const AVATAR_SIZE = 72;
const STAT_CARD_Y = HEADER_H + 8;
const STAT_CARD_H = 72;
const STAT_CARD_GAP = 12;
const CHART_Y = STAT_CARD_Y + STAT_CARD_H + 16;
const CHART_H = 110;
const GRAY_CIRCLE_COLOR = '#cccccc';
const EXCHANGE_ICON = '⇆';

/**
 * 친밀도 카드 PNG 렌더러.
 * 800×380px 캔버스에 두 사용자 아바타, 통계 카드 3개, 일별 막대 차트를 그린다.
 */
@Injectable()
export class AffinityCardRenderer {
  private readonly logger = new Logger(AffinityCardRenderer.name);

  // CanvasFontsService는 CanvasModule.onModuleInit()에서 이미 register()를 호출
  constructor(private readonly canvasFonts: CanvasFontsService) {}

  /**
   * AffinityCardData를 받아 PNG Buffer를 반환한다.
   */
  async render(data: AffinityCardData): Promise<Buffer> {
    const canvas = createCanvas(CARD_W, CARD_H);
    const ctx = canvas.getContext('2d');

    drawCardBackground(ctx, CARD_W, CARD_H);
    await this.drawHeader(ctx, data);
    this.drawHorizontalDivider(ctx, HEADER_H + PADDING / 2);
    this.drawStatCards(ctx, data);
    this.drawChart(ctx, data);

    return canvas.toBuffer('image/png');
  }

  // ── 헤더: A 아바타 ⇆ B 아바타 ───────────────────────────────────────────────

  private async drawHeader(ctx: SKRSContext2D, data: AffinityCardData): Promise<void> {
    const { userA, userB, period } = data;
    const centerX = CARD_W / 2;
    const avatarY = PADDING + 4;
    const avatarCY = avatarY + AVATAR_SIZE / 2;

    // A 아바타 (오른쪽 가장자리가 중심에서 ~120px)
    const aAvatarCX = centerX - 130;
    await this.drawUserAvatar(ctx, userA.avatarUrl, aAvatarCX, avatarCY, AVATAR_SIZE / 2);

    // ⇆ 아이콘
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = 'bold 22px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(EXCHANGE_ICON, centerX, avatarCY + 8);
    ctx.textAlign = 'left';

    // B 아바타
    const bAvatarCX = centerX + 130;
    await this.drawUserAvatar(ctx, userB.avatarUrl, bAvatarCX, avatarCY, AVATAR_SIZE / 2);

    // A 닉네임
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = 'bold 16px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.textAlign = 'center';
    const normalizedA = normalizeDisplayName(userA.displayName);
    ctx.fillText(truncateName(ctx, normalizedA, 200), aAvatarCX, avatarY + AVATAR_SIZE + 18);

    // B 닉네임
    const normalizedB = normalizeDisplayName(userB.displayName);
    ctx.fillText(truncateName(ctx, normalizedB, 200), bAvatarCX, avatarY + AVATAR_SIZE + 18);

    // 부제목
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '13px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(`💞 최근 ${period}일 함께한 시간`, centerX, avatarY + AVATAR_SIZE + 38);
    ctx.textAlign = 'left';
  }

  private async drawUserAvatar(
    ctx: SKRSContext2D,
    avatarUrl: string | null,
    cx: number,
    cy: number,
    r: number,
  ): Promise<void> {
    if (!avatarUrl) {
      drawGrayCircle(ctx, cx, cy, r);
      return;
    }
    try {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = BLURPLE;
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch {
      this.logger.warn('친밀도 카드: 아바타 로딩 실패');
      drawGrayCircle(ctx, cx, cy, r);
    }
  }

  // ── 통계 카드 3개 (총 시간 / 세션 수 / 마지막 날짜) ────────────────────────

  private drawStatCards(ctx: SKRSContext2D, data: AffinityCardData): void {
    const { totalMinutes, sessionCount, lastDate } = data;
    const statW = Math.floor((CARD_W - PADDING * 2 - 32 - STAT_CARD_GAP * 2) / 3);
    const startX = PADDING + 16;

    drawStatCardWithSub(ctx, {
      x: startX,
      y: STAT_CARD_Y,
      w: statW,
      h: STAT_CARD_H,
      label: '🕐 총 동시접속',
      value: formatMinutes(totalMinutes),
      subText: '',
    });

    drawStatCardWithSub(ctx, {
      x: startX + statW + STAT_CARD_GAP,
      y: STAT_CARD_Y,
      w: statW,
      h: STAT_CARD_H,
      label: '🔁 세션 수',
      value: `${sessionCount}회`,
      subText: '',
    });

    drawStatCardWithSub(ctx, {
      x: startX + (statW + STAT_CARD_GAP) * 2,
      y: STAT_CARD_Y,
      w: statW,
      h: STAT_CARD_H,
      label: '📅 마지막',
      value: lastDate ? lastDate.slice(5) : '없음',
      subText: '',
    });
  }

  // ── 일별 막대 차트 ───────────────────────────────────────────────────────────

  private drawChart(ctx: SKRSContext2D, data: AffinityCardData): void {
    if (data.dailyData.length === 0) {
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '14px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('기간 내 함께한 기록이 없어요', CARD_W / 2, CHART_Y + CHART_H / 2);
      ctx.textAlign = 'left';
      return;
    }

    drawBarChart(ctx, {
      x: PADDING + 16,
      y: CHART_Y,
      w: CARD_W - PADDING * 2 - 32,
      h: CHART_H,
      entries: data.dailyData.map((d) => ({
        date: d.date.replace(/-/g, ''),
        value: d.minutes,
      })),
      title: '📊 일별 추이',
    });
  }

  // ── 공통 ─────────────────────────────────────────────────────────────────────

  private drawHorizontalDivider(ctx: SKRSContext2D, y: number): void {
    ctx.beginPath();
    ctx.moveTo(PADDING + 16, y);
    ctx.lineTo(CARD_W - PADDING - 16, y);
    ctx.strokeStyle = DIVIDER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── 모듈 내부 헬퍼 함수들 ────────────────────────────────────────────────────

function drawCardBackground(ctx: SKRSContext2D, w: number, h: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  roundRect(ctx, PADDING / 2, PADDING / 2, w - PADDING, h - PADDING, CARD_RADIUS);
  ctx.fillStyle = CARD_BG;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGrayCircle(ctx: SKRSContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = GRAY_CIRCLE_COLOR;
  ctx.fill();
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0분';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}
