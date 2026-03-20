/** Kazagumo NestJS 의존성 주입 토큰 */
export const KAZAGUMO_TOKEN = 'KAZAGUMO_INSTANCE';

/** Now Playing Embed 진행바 설정 */
export const PROGRESS_BAR_LENGTH = 20;
export const PROGRESS_BAR_FILLED = '=';
export const PROGRESS_BAR_EMPTY = ' ';
export const PROGRESS_BAR_HEAD = '>';

/** 기본 볼륨 (0~100) */
export const DEFAULT_VOLUME = 40;

/** 빈 큐 시 채널 퇴장 대기 시간 (ms) */
export const LEAVE_ON_EMPTY_COOLDOWN_MS = 300_000;

/** Now Playing Embed 색상 */
export const EMBED_COLOR_PLAYING = 0x00_ae_86;
export const EMBED_COLOR_PAUSED = 0xff_a5_00;
