import type { BadgeCode } from './badge.constants';

export interface SelfDiagnosisResult {
  // 활동량
  totalMinutes: number;
  activeDays: number;
  totalDays: number;
  activeDaysRatio: number;
  avgDailyMinutes: number;
  activityRank: number;
  activityTotalUsers: number;
  activityTopPercent: number;

  // 관계 다양성
  peerCount: number;
  hhiScore: number;
  topPeers: PeerInfo[];

  // 모코코 기여
  hasMocoActivity: boolean;
  mocoScore: number;
  mocoRank: number;
  mocoTotalUsers: number;
  mocoTopPercent: number;
  mocoHelpedNewbies: number;

  // 참여 패턴
  micUsageRate: number;
  aloneRatio: number;

  // 정책 판정
  verdicts: Verdict[];

  // 뱃지
  badges: BadgeCode[];
  badgeGuides: BadgeGuide[];

  // LLM 요약
  llmSummary?: string;
}

export interface PeerInfo {
  userId: string;
  userName: string;
  minutes: number;
  ratio: number;
}

export interface Verdict {
  category: string;
  isPassed: boolean;
  criterion: string;
  actual: string;
}

export interface BadgeGuide {
  code: BadgeCode;
  name: string;
  icon: string;
  isEarned: boolean;
  criterion: string;
  current: string;
}
