/** Bot → API 요청/응답 DTO 타입 정의 */

// ── Voice ──

export interface VoiceStateUpdateDto {
  guildId: string;
  userId: string;
  channelId: string | null;
  oldChannelId: string | null;
  /** 'join' | 'leave' | 'move' | 'mic_toggle' */
  eventType: string;
  isSelfMute?: boolean;
  displayName?: string;
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

// ── Sticky Message ──

export interface MessageCreatedDto {
  guildId: string;
  channelId: string;
  authorId: string;
  isBot: boolean;
}

// ── Common ──

export interface BotApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
