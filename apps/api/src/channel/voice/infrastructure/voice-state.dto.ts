import { VoiceState } from 'discord.js';

export class VoiceStateDTO {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly channelId: string,
    public readonly parentCategoryId: string,
    public readonly micOn: boolean,
    public readonly alone: boolean,
  ) {}

  static fromVoiceState(state: VoiceState): VoiceStateDTO {
    if (!state.guild || !state.member || !state.channelId || !state.channel.parentId) {
      throw new Error('Invalid VoiceState for JoinCommand');
    }

    return new VoiceStateDTO(
      state.guild.id,
      state.member.id,
      state.channelId,
      state.channel.parentId,
      !state.selfMute,
      state.channel ? state.channel.members.size === 1 : false,
    );
  }
}
