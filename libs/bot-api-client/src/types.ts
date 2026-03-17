/** Bot → API 요청/응답 DTO 타입 정의 */

// ── Voice ──

export interface VoiceStateUpdateDto {
  guildId: string;
  userId: string;
  channelId: string | null;
  oldChannelId: string | null;
  eventType: 'join' | 'leave' | 'move' | 'mic_toggle';

  // 기존 VoiceStateDto 대응 필드
  userName: string;
  channelName: string | null;
  oldChannelName: string | null;
  parentCategoryId: string | null;
  categoryName: string | null;
  oldParentCategoryId: string | null;
  oldCategoryName: string | null;
  micOn: boolean;
  avatarUrl: string | null;

  // 채널 멤버 정보 (alone 감지 + auto-channel empty 감지용)
  channelMemberCount: number;
  oldChannelMemberCount: number;
  channelMemberIds: string[];
  oldChannelMemberIds: string[];
}

// ── Newbie ──

export interface MemberJoinDto {
  guildId: string;
  memberId: string;
  displayName: string;
}

export interface MissionRefreshDto {
  guildId: string;
}

export interface MocoRankRequestDto {
  guildId: string;
  page: number;
}

export interface MocoMyHuntingRequestDto {
  guildId: string;
  userId: string;
}

export interface NewbieConfigDto {
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  missionEnabled: boolean;
  roleEnabled: boolean;
  newbieRoleId: string | null;
  roleDurationDays: number | null;
}

export interface RoleAssignedDto {
  guildId: string;
  memberId: string;
}

// ── Guild ──

export interface MemberDisplayNameResponse {
  userId: string;
  displayName: string;
}

export interface RoleModifyDto {
  guildId: string;
  memberId: string;
  roleId: string;
}

export interface KickMemberDto {
  guildId: string;
  memberId: string;
  reason?: string;
}

// ── Status Prefix ──

export interface StatusPrefixApplyDto {
  guildId: string;
  memberId: string;
  buttonId: number;
  currentDisplayName: string;
}

export interface StatusPrefixResetDto {
  guildId: string;
  memberId: string;
}

export interface StatusPrefixApplyResult {
  success: boolean;
  newNickname?: string;
  message: string;
}

export interface StatusPrefixResetResult {
  success: boolean;
  originalNickname?: string;
  message: string;
}

// ── Auto Channel ──

export interface AutoChannelButtonClickDto {
  guildId: string;
  userId: string;
  buttonId: number;
}

export interface AutoChannelSubOptionDto {
  guildId: string;
  userId: string;
  subOptionId: number;
}

export interface AutoChannelButtonResult {
  action: 'created' | 'waiting' | 'error' | 'show_sub_options';
  channelId?: string;
  channelName?: string;
  message: string;
}

// ── Sticky Message ──

export interface MessageCreatedDto {
  guildId: string;
  channelId: string;
  authorId: string;
  isBot: boolean;
}

export interface StickyMessageConfigItem {
  channelId: string;
  embedTitle: string | null;
  enabled: boolean;
}

// ── Voice Analytics ──

export interface MyVoiceStatsResponse {
  ok: boolean;
  data: {
    userId: string;
    username: string;
    totalVoiceTime: number;
    totalMicOnTime: number;
    totalMicOffTime: number;
    aloneTime: number;
    activeChannels: Array<{ channelId: string; channelName: string; duration: number }>;
    activeDays: number;
    avgDailyVoiceTime: number;
    micUsageRate: number;
    userRank: number;
    totalUsers: number;
  } | null;
  days: number;
}

export interface LeaderboardResponse {
  ok: boolean;
  data: {
    userActivities: Array<{
      userId: string;
      username: string;
      totalVoiceTime: number;
      micUsageRate: number;
    }>;
  } | null;
  days: number;
}

export interface VoiceAnalyzeResponse {
  ok: boolean;
  data: {
    analysisText: string;
    totalStats: {
      totalUsers: number;
      totalVoiceTime: number;
      totalMicOnTime: number;
      avgDailyActiveUsers: number;
    };
  } | null;
  days: number;
}

export interface CommunityHealthResponse {
  ok: boolean;
  data: { healthText: string } | null;
  days: number;
}

export interface SelfDiagnosisResponse {
  ok: boolean;
  data: {
    result: SelfDiagnosisResultData;
    analysisDays: number;
    isCooldownEnabled: boolean;
    cooldownHours: number;
  } | null;
  reason?: 'not_enabled' | 'cooldown' | 'quota_exhausted';
  remainingSeconds?: number;
}

export interface SelfDiagnosisResultData {
  totalMinutes: number;
  activeDays: number;
  totalDays: number;
  activeDaysRatio: number;
  avgDailyMinutes: number;
  activityRank: number;
  activityTotalUsers: number;
  activityTopPercent: number;
  peerCount: number;
  hhiScore: number;
  topPeers: Array<{ userId: string; userName: string; minutes: number; ratio: number }>;
  hasMocoActivity: boolean;
  mocoScore: number;
  mocoRank: number;
  mocoTotalUsers: number;
  mocoTopPercent: number;
  mocoHelpedNewbies: number;
  micUsageRate: number;
  aloneRatio: number;
  verdicts: Array<{ category: string; isPassed: boolean; criterion: string; actual: string }>;
  badges: string[];
  badgeGuides: Array<{
    code: string;
    name: string;
    icon: string;
    isEarned: boolean;
    criterion: string;
    current: string;
  }>;
  llmSummary?: string;
}

export interface MeProfileResponse {
  ok: boolean;
  data: { imageBase64: string } | null;
  days: number;
}

// ── Co-Presence ──

export interface CoPresenceSnapshot {
  guildId: string;
  channelId: string;
  userIds: string[];
}

// ── Monitoring ──

export interface BotGuildMetric {
  guildId: string;
  status: 'ONLINE' | 'OFFLINE';
  pingMs: number;
  heapUsedMb: number;
  heapTotalMb: number;
  voiceUserCount: number;
  guildCount: number;
}

export interface BotStatusPayload {
  online: boolean;
  uptimeMs: number;
  startedAt: string | null;
  pingMs: number;
  guildCount: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
  voiceUserCount: number;
}

// ── Common ──

export interface BotApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
