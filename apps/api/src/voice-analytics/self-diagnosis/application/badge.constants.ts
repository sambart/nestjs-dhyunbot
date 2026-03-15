export const BADGE_CODE = {
  ACTIVITY: 'ACTIVITY',
  SOCIAL: 'SOCIAL',
  HUNTER: 'HUNTER',
  CONSISTENT: 'CONSISTENT',
  MIC: 'MIC',
} as const;

export type BadgeCode = (typeof BADGE_CODE)[keyof typeof BADGE_CODE];

export const BADGE_PRIORITY: BadgeCode[] = [
  BADGE_CODE.ACTIVITY,
  BADGE_CODE.SOCIAL,
  BADGE_CODE.HUNTER,
  BADGE_CODE.CONSISTENT,
  BADGE_CODE.MIC,
];

export const BADGE_DISPLAY: Record<
  BadgeCode,
  { name: string; icon: string; bgColor: string; textColor: string }
> = {
  ACTIVITY: { name: '활동왕', icon: '🔥', bgColor: '#FEF3C7', textColor: '#92400E' },
  SOCIAL: { name: '사교왕', icon: '🌐', bgColor: '#DBEAFE', textColor: '#1E40AF' },
  HUNTER: { name: '헌터', icon: '🌱', bgColor: '#D1FAE5', textColor: '#065F46' },
  CONSISTENT: { name: '꾸준러', icon: '📅', bgColor: '#E0E7FF', textColor: '#3730A3' },
  MIC: { name: '소통러', icon: '🎤', bgColor: '#FCE7F3', textColor: '#9D174D' },
};

export const MAX_BADGE_DISPLAY = 4;
