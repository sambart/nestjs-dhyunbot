// Shared constants

export const APP_NAME = 'DHyunBot';
export const DEFAULT_COMMAND_PREFIX = '!';

export const DATE_FORMAT = {
  ISO: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
} as const;

export const REDIS_KEYS = {
  VOICE_SESSION: 'voice:session',
  VOICE_TEMP_CHANNEL: 'voice:temp:channel',
  DAILY_STATS: 'voice:daily',
} as const;
