import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';

import {
  ACCENT,
  BG,
  BLURPLE,
  BORDER,
  CARD_BG,
  DIVIDER,
  drawBarChart,
  drawStatCardWithSub,
  formatTime,
  MIC_OFF_COLOR,
  MIC_ON_COLOR,
  normalizeDisplayName,
  RANK_BG,
  RANK_BORDER,
  roundRect,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  truncateName,
} from '../../../common/canvas';
import type { BadgeCode } from '../../../voice-analytics/self-diagnosis/application/badge.constants';
import {
  BADGE_DISPLAY,
  BADGE_PRIORITY,
  MAX_BADGE_DISPLAY,
} from '../../../voice-analytics/self-diagnosis/application/badge.constants';
import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.types';
import type { DailyChartEntry, ExcludedChannelEntry, MeProfileData } from './me-profile.service';

// ── 레이아웃 상수 (/me 전용 — common/canvas 추출 범위 외) ──
const W = 800;
const H = 650;
const PADDING = 32;
const CARD_RADIUS = 16;

// ── 뱃지 pill 레이아웃 상수 ──
const PILL_H = 22;
const PILL_PX = 8;
const PILL_GAP = 6;
const PILL_R = 11;
const PILL_FONT = 'bold 11px "NotoSansCJK", "NotoColorEmoji", sans-serif';

// ── Footer 제외 채널 표시 상수 ──
const MAX_EXCLUDED_DISPLAY = 5;

@Injectable()
export class ProfileCardRenderer {
  private readonly logger = new Logger(ProfileCardRenderer.name);

  // 폰트 등록은 CanvasModule.onModuleInit()에서 1회 수행하므로 생성자에서 별도 처리 불필요

  async render(profile: MeProfileData, displayName: string, avatarUrl: string): Promise<Buffer> {
    const normalizedName = normalizeDisplayName(displayName);

    // 뱃지 유무에 따라 캔버스 높이와 콘텐츠 오프셋 조정
    const hasBadges = profile.badges.length > 0;
    const badgeOffset = hasBadges ? 18 : 0;
    const canvasH = H + badgeOffset;

    const canvas = createCanvas(W, canvasH);
    const ctx = canvas.getContext('2d');

    this.drawBackground(ctx, canvasH);
    await this.drawHeader(ctx, { displayName: normalizedName, avatarUrl, badges: profile.badges });
    this.drawRankCard(ctx, profile, badgeOffset);
    this.drawStatCards(ctx, profile, badgeOffset);
    drawBarChart(ctx, {
      x: PADDING + 16,
      y: 398 + badgeOffset,
      w: W - PADDING * 2 - 32,
      h: 170,
      entries: profile.dailyChart.map((d: DailyChartEntry) => ({
        date: d.date,
        value: d.durationSec,
      })),
      title: '📅 최근 15일 활동',
    });
    this.drawFooter(ctx, canvasH, profile.excludedChannels);

    return canvas.toBuffer('image/png');
  }

  private drawBackground(ctx: SKRSContext2D, canvasH: number): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, canvasH);

    roundRect(ctx, PADDING / 2, PADDING / 2, W - PADDING, canvasH - PADDING, CARD_RADIUS);
    ctx.fillStyle = CARD_BG;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private async drawHeader(
    ctx: SKRSContext2D,
    params: { displayName: string; avatarUrl: string; badges: string[] },
  ): Promise<void> {
    const { displayName, avatarUrl, badges } = params;
    const headerY = 40;

    try {
      const avatar = await loadImage(avatarUrl);
      const avatarSize = 64;
      const ax = PADDING + 16;
      const ay = headerY;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = BLURPLE;
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch {
      this.logger.warn('Failed to load avatar');
    }

    const nameX = PADDING + 96;
    const nameY = headerY + 30;
    const maxRight = W - PADDING - 16;

    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = 'bold 28px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    const maxNameWidth = maxRight - nameX;
    const truncatedName = truncateName(ctx, displayName, maxNameWidth);
    ctx.fillText(truncatedName, nameX, nameY);

    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = '14px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText('최근 15일 음성 활동', PADDING + 96, headerY + 56);

    // 뱃지 행 (디바이더 위)
    if (badges.length > 0) {
      this.drawBadgePills(ctx, { badges, startX: PADDING + 16, centerY: headerY + 80 });
    }

    const dividerY = badges.length > 0 ? headerY + 96 : headerY + 78;
    ctx.beginPath();
    ctx.moveTo(PADDING + 16, dividerY);
    ctx.lineTo(W - PADDING - 16, dividerY);
    ctx.strokeStyle = DIVIDER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBadgePills(
    ctx: SKRSContext2D,
    params: { badges: string[]; startX: number; centerY: number },
  ): void {
    const { badges, startX, centerY } = params;
    const sorted = BADGE_PRIORITY.filter((code) => badges.includes(code)).slice(
      0,
      MAX_BADGE_DISPLAY,
    );

    if (sorted.length === 0) return;

    ctx.font = PILL_FONT;

    let x = startX;
    for (const code of sorted) {
      const display = BADGE_DISPLAY[code as BadgeCode];
      const text = `${display.icon}${display.name}`;
      const textWidth = ctx.measureText(text).width;
      const pillW = textWidth + PILL_PX * 2;

      roundRect(ctx, x, centerY - PILL_H / 2, pillW, PILL_H, PILL_R);
      ctx.fillStyle = display.bgColor;
      ctx.fill();

      ctx.fillStyle = display.textColor;
      ctx.fillText(text, x + PILL_PX, centerY + 4);

      x += pillW + PILL_GAP;
    }
  }

  private drawRankCard(ctx: SKRSContext2D, profile: MeProfileData, badgeOffset: number): void {
    const y = 130 + badgeOffset;
    const cardX = PADDING + 16;
    const cardW = W - PADDING * 2 - 32;
    const cardH = 56;

    roundRect(ctx, cardX, y, cardW, cardH, 10);
    ctx.fillStyle = RANK_BG;
    ctx.fill();
    ctx.strokeStyle = RANK_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    const rankEmoji = profile.rank === 1 ? '👑' : profile.rank <= 3 ? '🏅' : '🏆';
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = 'bold 20px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(`${rankEmoji}  ${profile.rank}위 / ${profile.totalUsers}명`, cardX + 16, y + 24);

    const topPercent =
      profile.totalUsers > 0 ? Math.round((profile.rank / profile.totalUsers) * 1000) / 10 : 0;
    ctx.fillStyle = BLURPLE;
    ctx.font = 'bold 16px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    const percentText = `상위 ${topPercent}%`;
    const percentWidth = ctx.measureText(percentText).width;
    ctx.fillText(percentText, cardX + cardW - percentWidth - 16, y + 24);

    const barX = cardX + 16;
    const barY = y + 36;
    const barW = cardW - 32;
    const barH = 8;

    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fillStyle = '#E0E7FF';
    ctx.fill();

    const fillRatio =
      profile.totalUsers > 0 ? (profile.totalUsers - profile.rank + 1) / profile.totalUsers : 0;
    if (fillRatio > 0) {
      const fillW = Math.max(barW * fillRatio, 10);
      roundRect(ctx, barX, barY, fillW, barH, 4);
      ctx.fillStyle = BLURPLE;
      ctx.fill();
    }
  }

  // eslint-disable-next-line max-lines-per-function
  private drawStatCards(ctx: SKRSContext2D, profile: MeProfileData, badgeOffset: number): void {
    const startY = 202 + badgeOffset;
    const cardW = 224;
    const cardH = 72;
    const gap = 16;
    const startX = PADDING + 16;

    // ── Row 1: 기본 통계 ──
    const row1Stats = [
      { label: '총 음성 시간', value: formatTime(profile.totalSec), icon: '🎙️' },
      { label: '활동일 수', value: `${profile.activeDays}일`, icon: '📆' },
      { label: '일평균', value: formatTime(profile.avgDailySec), icon: '⏱️' },
    ];

    for (let i = 0; i < row1Stats.length; i++) {
      const stat = row1Stats[i];
      const x = startX + i * (cardW + gap);
      const y = startY;

      roundRect(ctx, x, y, cardW, cardH, 8);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = TEXT_SECONDARY;
      ctx.font = '13px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.fillText(`${stat.icon} ${stat.label}`, x + 14, y + 24);

      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = 'bold 22px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.fillText(stat.value, x + 14, y + 54);
    }

    // ── Row 2: 통합 카드들 ──
    const row2Y = startY + cardH + gap;

    // 카드 1: 마이크 통합 (ON/OFF 비율 바 + 사용률 + 시간)
    this.drawMicCard(ctx, { x: startX, y: row2Y, w: cardW, h: cardH, profile });

    // 카드 2: 혼자 비율
    const alonePercent =
      profile.totalSec > 0 ? Math.round((profile.aloneSec / profile.totalSec) * 1000) / 10 : 0;
    drawStatCardWithSub(ctx, {
      x: startX + cardW + gap,
      y: row2Y,
      w: cardW,
      h: cardH,
      label: '👤 혼자 있던 시간',
      value: formatTime(profile.aloneSec),
      subText: `전체의 ${alonePercent}%`,
    });

    // 카드 3: 주평균 + 피크요일 통합
    const peakText = profile.peakDayOfWeek ? `피크: ${profile.peakDayOfWeek}요일` : '';
    drawStatCardWithSub(ctx, {
      x: startX + (cardW + gap) * 2,
      y: row2Y,
      w: cardW,
      h: cardH,
      label: '📊 주 평균',
      value: formatTime(profile.weeklyAvgSec),
      subText: peakText,
    });
  }

  // eslint-disable-next-line max-lines-per-function
  private drawMicCard(
    ctx: SKRSContext2D,
    params: { x: number; y: number; w: number; h: number; profile: MeProfileData },
  ): void {
    const { x, y, w, h, profile } = params;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 라벨
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = '13px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText('🎤 마이크', x + 14, y + 24);

    // ON/OFF 시간 (제목 오른쪽)
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '10px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `ON ${formatTime(profile.micOnSec)} · OFF ${formatTime(profile.micOffSec)}`,
      x + w - 10,
      y + 24,
    );
    ctx.textAlign = 'left';

    // 사용률 텍스트
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = 'bold 18px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(`${profile.micUsageRate}%`, x + 14, y + 48);

    // ON/OFF 비율 바
    const barX = x + 80;
    const barY = y + 36;
    const barW = w - 96;
    const barH = 14;
    const totalMic = profile.micOnSec + profile.micOffSec;

    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fillStyle = MIC_OFF_COLOR;
    ctx.fill();

    if (totalMic > 0) {
      const onRatio = profile.micOnSec / totalMic;
      const onW = Math.max(barW * onRatio, onRatio > 0 ? 6 : 0);
      if (onW > 0) {
        roundRect(ctx, barX, barY, onW, barH, 4);
        ctx.fillStyle = MIC_ON_COLOR;
        ctx.fill();
      }
    }

    // ON/OFF 라벨
    ctx.font = '10px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillStyle = MIC_ON_COLOR;
    ctx.fillText('ON', barX, barY + barH + 12);
    ctx.fillStyle = MIC_OFF_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText('OFF', barX + barW, barY + barH + 12);
    ctx.textAlign = 'left';
  }

  private drawFooter(
    ctx: SKRSContext2D,
    canvasH: number,
    excludedChannels: ExcludedChannelEntry[],
  ): void {
    const footerText = this.buildFooterText(excludedChannels);
    if (!footerText) return;

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '12px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(footerText, PADDING + 16, canvasH - PADDING / 2 - 4);
  }

  private buildFooterText(excludedChannels: ExcludedChannelEntry[]): string {
    if (excludedChannels.length === 0) return '';

    const displayed = excludedChannels.slice(0, MAX_EXCLUDED_DISPLAY);
    const remaining = excludedChannels.length - displayed.length;

    const channelLabels = displayed.map((ch) => {
      const prefix = ch.type === VoiceExcludedChannelType.CATEGORY ? '[카테고리]' : '[채널]';
      return `${prefix} ${ch.name}`;
    });

    let text = `통계 제외 채널: ${channelLabels.join(', ')}`;
    if (remaining > 0) {
      text += ` ... 외 ${remaining}개`;
    }
    return text;
  }
}
