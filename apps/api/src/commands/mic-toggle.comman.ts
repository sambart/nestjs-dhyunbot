import { VoiceState } from 'discord.js';

export class MicToggleCommand {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly channelId: string,
  ) {}

  static fromVoiceState(state: VoiceState): MicToggleCommand {
    if (!state.guild || !state.member || !state.channelId) {
      throw new Error('Invalid VoiceState for JoinCommand');
    }

    return new MicToggleCommand(state.guild.id, state.member.id, state.channelId);
  }
}
