/** 대기방 Redis 상태 (auto_channel:waiting:{channelId}) */
export interface AutoChannelWaitingState {
  guildId: string;
  userId: string;
  triggerChannelId: string;
  configId: number;
}

/** 확정방 Redis 상태 (auto_channel:confirmed:{channelId}) */
export interface AutoChannelConfirmedState {
  guildId: string;
  userId: string;
  buttonId: number;
  subOptionId?: number;
}
