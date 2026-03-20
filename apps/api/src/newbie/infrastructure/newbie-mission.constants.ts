import { MissionStatus } from '../domain/newbie-mission.types';

/** 미션 상태별 Discord Embed 표시 이모지 */
export const MISSION_STATUS_EMOJI: Record<MissionStatus, string> = {
  [MissionStatus.IN_PROGRESS]: '🟡',
  [MissionStatus.COMPLETED]: '✅',
  [MissionStatus.FAILED]: '❌',
  [MissionStatus.LEFT]: '🚪',
} as const;

/** 미션 상태별 한국어 텍스트 */
export const MISSION_STATUS_TEXT: Record<MissionStatus, string> = {
  [MissionStatus.IN_PROGRESS]: '진행중',
  [MissionStatus.COMPLETED]: '완료',
  [MissionStatus.FAILED]: '실패',
  [MissionStatus.LEFT]: '탈퇴',
} as const;
