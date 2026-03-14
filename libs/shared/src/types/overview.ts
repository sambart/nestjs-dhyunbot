export interface GuildOverviewResponse {
  totalMemberCount: number;
  todayVoiceTotalSec: number;
  currentVoiceUserCount: number;
  activeRate: number;
  inactiveByGrade: {
    fullyInactive: number;
    lowActive: number;
    declining: number;
  };
  missionSummary: {
    inProgress: number;
    completed: number;
    failed: number;
  } | null;
  weeklyVoice: Array<{
    date: string;
    totalSec: number;
  }>;
}
