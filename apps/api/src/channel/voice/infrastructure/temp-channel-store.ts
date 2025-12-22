export interface TempChannelStore {
  registerTempChannel(guildId: string, channelId: string): Promise<void>;
  unregisterTempChannel(guildId: string, channelId: string): Promise<void>;

  isTempChannel(guildId: string, channelId: string): Promise<boolean>;

  addMember(channelId: string, userId: string): Promise<void>;
  removeMember(channelId: string, userId: string): Promise<void>;

  isEmpty(channelId: string): Promise<boolean>;
}
