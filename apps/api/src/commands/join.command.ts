import { VoiceState } from 'discord.js';

export class JoinCommand {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly channelId: string,
    public readonly parentCategoryId: string,
  ) {}

  static fromVoiceState(state: VoiceState): JoinCommand {
    if (!state.guild || !state.member || !state.channelId || !state.channel.parentId) {
      throw new Error('Invalid VoiceState for JoinCommand');
    }

    return new JoinCommand(
      state.guild.id,
      state.member.id,
      state.channelId,
      state.channel.parentId,
    );
  }
}
