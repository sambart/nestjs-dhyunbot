export const AutoChannelKeys = {
  /** 대기방 메타데이터: auto_channel:waiting:{channelId} */
  waiting: (channelId: string) => `auto_channel:waiting:${channelId}`,

  /** 확정방 메타데이터: auto_channel:confirmed:{channelId} */
  confirmed: (channelId: string) => `auto_channel:confirmed:${channelId}`,

  /** 서버별 트리거 채널 집합: auto_channel:trigger:{guildId} */
  triggerSet: (guildId: string) => `auto_channel:trigger:${guildId}`,
};
