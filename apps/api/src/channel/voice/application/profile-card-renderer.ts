import { createCanvas, GlobalFonts, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';

import { DailyChartEntry, MeProfileData } from './me-profile.service';

// ── 레이아웃 상수 ──
const W = 800;
const H = 720;
const PADDING = 32;
const CARD_RADIUS = 16;

// ── 색상 팔레트 (대시보드 라이트 테마 기반) ──
const BG = '#f0f0f0';
const CARD_BG = '#ffffff';
const ACCENT = '#f5f5f5';
const BLURPLE = '#5B8DEF';
const BLURPLE_DIM = '#c4d7f7';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#6b6b6b';
const TEXT_MUTED = '#9a9a9a';
const BAR_EMPTY = '#e8e8e8';
const DIVIDER = '#e5e5e5';
const BORDER = '#e0e0e0';

@Injectable()
export class ProfileCardRenderer {
  private readonly logger = new Logger(ProfileCardRenderer.name);

  constructor() {
    this.registerFonts();
  }

  private registerFonts(): void {
    // CJK 폰트 등록
    const cjkPaths = [
      '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ];
    for (const path of cjkPaths) {
      try {
        GlobalFonts.registerFromPath(path, 'NotoSansCJK');
        this.logger.log(`CJK font registered: ${path}`);
        break;
      } catch {
        // try next path
      }
    }

    // Emoji 폰트 등록
    const emojiPaths = [
      '/usr/share/fonts/noto/NotoColorEmoji.ttf',
      '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
    ];
    for (const path of emojiPaths) {
      try {
        GlobalFonts.registerFromPath(path, 'NotoColorEmoji');
        this.logger.log(`Emoji font registered: ${path}`);
        break;
      } catch {
        // try next path
      }
    }
  }

  async render(profile: MeProfileData, displayName: string, avatarUrl: string): Promise<Buffer> {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── 배경 ──
    this.drawBackground(ctx);

    // ── 헤더: 아바타 + 이름 + 랭킹 ──
    await this.drawHeader(ctx, profile, displayName, avatarUrl);

    // ── 통계 카드들 ──
    this.drawStatCards(ctx, profile);

    // ── 바 차트 ──
    this.drawBarChart(ctx, profile.dailyChart);

    // ── 푸터 ──
    this.drawFooter(ctx);

    return canvas.toBuffer('image/png');
  }

  private drawBackground(ctx: SKRSContext2D): void {
    // 배경
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // 메인 카드
    this.roundRect(ctx, PADDING / 2, PADDING / 2, W - PADDING, H - PADDING, CARD_RADIUS);
    ctx.fillStyle = CARD_BG;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private async drawHeader(
    ctx: SKRSContext2D,
    profile: MeProfileData,
    displayName: string,
    avatarUrl: string,
  ): Promise<void> {
    const headerY = 40;

    // 아바타
    try {
      const avatar = await loadImage(avatarUrl);
      const avatarSize = 64;
      const ax = PADDING + 16;
      const ay = headerY;

      // 원형 클리핑
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
      ctx.restore();

      // 아바타 테두리
      ctx.beginPath();
      ctx.arc(ax + avatarSize / 2, ay + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = BLURPLE;
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch {
      this.logger.warn('Failed to load avatar');
    }

    // 닉네임
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = 'bold 28px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(displayName, PADDING + 96, headerY + 30);

    // 랭킹 배지 (닉네임 옆)
    const nameWidth = ctx.measureText(displayName).width;
    const rankEmoji = profile.rank === 1 ? '👑 ' : profile.rank <= 3 ? '🏅 ' : '🎖️ ';
    const rankText = `${rankEmoji}#${profile.rank}`;
    ctx.fillStyle = BLURPLE;
    ctx.font = 'bold 18px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    const badgeX = PADDING + 96 + nameWidth + 12;
    ctx.fillText(rankText, badgeX, headerY + 30);

    // 기간 + 전체 유저
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = '14px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText(`최근 15일 · ${profile.totalUsers}명 중`, PADDING + 96, headerY + 58);

    // 구분선
    ctx.beginPath();
    ctx.moveTo(PADDING + 16, headerY + 78);
    ctx.lineTo(W - PADDING - 16, headerY + 78);
    ctx.strokeStyle = DIVIDER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawStatCards(ctx: SKRSContext2D, profile: MeProfileData): void {
    const startY = 140;
    const cardW = 230;
    const cardH = 72;
    const gap = 16;
    const startX = PADDING + 16;

    const stats = [
      { label: '총 음성 시간', value: formatTime(profile.totalSec), icon: '🎙️' },
      { label: '활동일 수', value: `${profile.activeDays}일`, icon: '📆' },
      { label: '일평균', value: formatTime(profile.avgDailySec), icon: '⏱️' },
      { label: '마이크 ON', value: formatTime(profile.micOnSec), icon: '🔊' },
      { label: '마이크 OFF', value: formatTime(profile.micOffSec), icon: '🔇' },
      { label: '사용률', value: `${profile.micUsageRate}%`, icon: '📈' },
      { label: '혼자 있던 시간', value: formatTime(profile.aloneSec), icon: '👤' },
      {
        label: '피크 요일',
        value: profile.peakDayOfWeek ? `${profile.peakDayOfWeek}요일` : '—',
        icon: '🕐',
      },
      { label: '주 평균', value: formatTime(profile.weeklyAvgSec), icon: '📊' },
    ];

    stats.forEach((stat, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      // 카드 배경
      this.roundRect(ctx, x, y, cardW, cardH, 8);
      ctx.fillStyle = ACCENT;
      ctx.fill();
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 아이콘 + 라벨
      ctx.fillStyle = TEXT_SECONDARY;
      ctx.font = '13px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.fillText(`${stat.icon} ${stat.label}`, x + 14, y + 24);

      // 값
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = 'bold 22px "NotoSansCJK", "NotoColorEmoji", sans-serif';
      ctx.fillText(stat.value, x + 14, y + 54);
    });
  }

  private drawBarChart(ctx: SKRSContext2D, dailyChart: DailyChartEntry[]): void {
    const chartX = PADDING + 16;
    const chartY = 420;
    const chartW = W - PADDING * 2 - 32;
    const chartH = 220;

    // 섹션 제목
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = 'bold 14px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.fillText('📅 최근 15일 활동', chartX, chartY - 8);

    // 차트 배경
    this.roundRect(ctx, chartX, chartY, chartW, chartH, 8);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    const maxSec = Math.max(...dailyChart.map((d) => d.durationSec), 1);
    const barCount = dailyChart.length;
    const barGap = 6;
    const barAreaW = chartW - 40;
    const barW = (barAreaW - barGap * (barCount - 1)) / barCount;
    const barMaxH = chartH - 50;
    const baseY = chartY + chartH - 16;

    dailyChart.forEach((entry, idx) => {
      const x = chartX + 20 + idx * (barW + barGap);
      const barH = entry.durationSec > 0 ? Math.max((entry.durationSec / maxSec) * barMaxH, 4) : 4;

      // 빈 바
      this.roundRect(ctx, x, baseY - barMaxH, barW, barMaxH, 3);
      ctx.fillStyle = BAR_EMPTY;
      ctx.fill();

      // 채워진 바
      if (entry.durationSec > 0) {
        this.roundRect(ctx, x, baseY - barH, barW, barH, 3);
        ctx.fillStyle = BLURPLE;
        ctx.fill();
      } else {
        this.roundRect(ctx, x, baseY - 4, barW, 4, 3);
        ctx.fillStyle = BLURPLE_DIM;
        ctx.fill();
      }

      // 날짜 라벨 (짝수 인덱스만)
      if (idx % 2 === 0) {
        const dd = entry.date.slice(6, 8);
        ctx.fillStyle = TEXT_MUTED;
        ctx.font = '10px "NotoSansCJK", "NotoColorEmoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dd, x + barW / 2, baseY + 12);
        ctx.textAlign = 'left';
      }
    });
  }

  private drawFooter(ctx: SKRSContext2D): void {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '12px "NotoSansCJK", "NotoColorEmoji", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('dhyunbot', W - PADDING - 16, H - PADDING / 2 - 4);
    ctx.textAlign = 'left';
  }

  private roundRect(
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
}

function formatTime(sec: number): string {
  if (sec === 0) return '0분';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}
