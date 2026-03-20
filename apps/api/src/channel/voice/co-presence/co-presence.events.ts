export const CO_PRESENCE_SESSION_ENDED = 'co-presence.session.ended';
export const CO_PRESENCE_TICK = 'co-presence.tick';

export interface CoPresenceSessionEndedEvent {
  guildId: string;
  channelId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  peerIds: string[];
  peerMinutes: Record<string, number>;
}

export interface CoPresenceTickEvent {
  snapshots: CoPresenceTickSnapshot[];
}

export interface CoPresenceTickSnapshot {
  guildId: string;
  channelId: string;
  userIds: string[];
  /** Phase 2: 멤버별 게임 활동 (optional) */
  memberActivities?: Array<{
    userId: string;
    gameName: string | null;
    applicationId: string | null;
  }>;
}
