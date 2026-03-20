import { EmbedBuilder } from 'discord.js';
import type { KazagumoPlayer, KazagumoTrack } from 'kazagumo';

import {
  EMBED_COLOR_PAUSED,
  EMBED_COLOR_PLAYING,
  PROGRESS_BAR_EMPTY,
  PROGRESS_BAR_FILLED,
  PROGRESS_BAR_HEAD,
  PROGRESS_BAR_LENGTH,
} from '../../music.constants';

interface NowPlayingEmbedOptions {
  track: KazagumoTrack;
  player: KazagumoPlayer;
  status: 'playing' | 'paused' | 'queued';
}

/**
 * Now Playing Embed를 생성한다.
 * PRD 명세: 제목(링크), 아티스트, 진행바(20칸), 현재시간/총시간, 상태
 */
export function buildNowPlayingEmbed(options: NowPlayingEmbedOptions): EmbedBuilder {
  const { track, player, status } = options;
  const positionMs = player.position;
  const durationMs = track.length;

  const progressBar = formatProgressBar(positionMs, durationMs);
  const timeString = `${formatTime(positionMs)} / ${formatTime(durationMs)}`;

  const statusLabel = {
    playing: '재생 중',
    paused: '일시정지',
    queued: '큐 대기',
  }[status];

  const color = status === 'playing' ? EMBED_COLOR_PLAYING : EMBED_COLOR_PAUSED;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(track.title)
    .setURL(track.uri ?? null)
    .addFields(
      { name: '아티스트', value: track.author ?? 'Unknown', inline: true },
      { name: '상태', value: statusLabel, inline: true },
      { name: '진행', value: `\`[${progressBar}]\`\n${timeString}` },
    );

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

/** ms를 M:SS 또는 H:MM:SS 형식으로 변환 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/** 진행바 문자열 생성 (20칸 기준) */
function formatProgressBar(positionMs: number, durationMs: number): string {
  if (durationMs <= 0) return PROGRESS_BAR_EMPTY.repeat(PROGRESS_BAR_LENGTH);

  const ratio = Math.min(positionMs / durationMs, 1);
  const filledCount = Math.min(Math.floor(ratio * PROGRESS_BAR_LENGTH), PROGRESS_BAR_LENGTH - 1);
  const emptyCount = PROGRESS_BAR_LENGTH - filledCount - 1;

  return (
    PROGRESS_BAR_FILLED.repeat(filledCount) +
    PROGRESS_BAR_HEAD +
    PROGRESS_BAR_EMPTY.repeat(Math.max(emptyCount, 0))
  );
}
