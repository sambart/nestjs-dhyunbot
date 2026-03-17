export const AUTO_CHANNEL_EVENTS = {
  CHANNEL_EMPTY: 'auto-channel.channel-empty',
} as const;

export class AutoChannelChannelEmptyEvent {
  constructor(
    public readonly guildId: string,
    public readonly channelId: string,
  ) {}
}
