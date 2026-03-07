export const AutoChannelKeys = {
  /** 확정방 메타데이터: auto_channel:confirmed:{channelId} */
  confirmed: (channelId: string) => `auto_channel:confirmed:${channelId}`,
};
