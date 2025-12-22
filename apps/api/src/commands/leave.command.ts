import { VoiceState } from 'discord.js';

export class LeaveCommand {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly channelId: string,
  ) {}

  static fromVoiceState(state: VoiceState): LeaveCommand {
    if (!state.guild || !state.member || !state.channelId) {
      throw new Error('Invalid VoiceState for JoinCommand');
    }

    return new LeaveCommand(state.guild.id, state.member.id, state.channelId);
  }
}
