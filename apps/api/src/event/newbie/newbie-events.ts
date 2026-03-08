export const NEWBIE_EVENTS = {
  /** voiceStateUpdate 발생 시 MocoService 처리용 — Dispatcher에서 추가 발행 */
  VOICE_STATE_CHANGED: 'newbie.voice-state-changed',
} as const;

export class NewbieVoiceStateChangedEvent {
  constructor(
    public readonly guildId: string,
    /** 이동 후 또는 입장한 채널 ID. 퇴장 시 null */
    public readonly channelId: string | null,
    /** 이동 전 또는 퇴장한 채널 ID. 입장 시 null */
    public readonly oldChannelId: string | null,
    /** 현재 채널(channelId)의 모든 멤버 ID 목록. channelId가 null이면 빈 배열 */
    public readonly channelMemberIds: string[],
  ) {}
}
