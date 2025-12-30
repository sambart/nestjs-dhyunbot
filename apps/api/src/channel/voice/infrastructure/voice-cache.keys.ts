export const VoiceKeys = {
  session: (guild: string, user: string) => `voice:session:${guild}:${user}`,

  channelDuration: (guild: string, user: string, date: string, channel: string) =>
    `voice:duration:channel:${guild}:${user}:${date}:${channel}`,

  micDuration: (guild: string, user: string, date: string, state: 'on' | 'off') =>
    `voice:duration:mic:${guild}:${user}:${date}:${state}`,

  aloneDuration: (guild: string, user: string, date: string) =>
    `voice:duration:alone:${guild}:${user}:${date}`,

  channelName: (guild: string, channel: string) => `voice:channel:name:${guild}:${channel}`,

  userName: (guild: string, user: string) => `voice:user:name:${guild}:${user}`,
};
