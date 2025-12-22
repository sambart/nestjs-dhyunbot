// voice.keys.ts
export const VoiceKeys = {
  session: (g: string, u: string) => `voice:session:${g}:${u}`,

  channelDuration: (g: string, u: string, date: string, channel: string) =>
    `voice:duration:channel:${g}:${u}:${date}:${channel}`,

  micDuration: (g: string, u: string, date: string, state: 'on' | 'off') =>
    `voice:duration:mic:${g}:${u}:${date}:${state}`,

  aloneDuration: (g: string, u: string, date: string) => `voice:duration:alone:${g}:${u}:${date}`,
};
