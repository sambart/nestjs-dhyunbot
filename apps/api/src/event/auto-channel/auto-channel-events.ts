import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';

export const AUTO_CHANNEL_EVENTS = {
  TRIGGER_JOIN: 'auto-channel.trigger-join',
  CHANNEL_EMPTY: 'auto-channel.channel-empty',
} as const;

export class AutoChannelTriggerJoinEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class AutoChannelChannelEmptyEvent {
  constructor(
    public readonly guildId: string,
    public readonly channelId: string,
  ) {}
}
