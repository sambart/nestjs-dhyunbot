import { VoiceState } from 'discord.js';

export class InvalidVoiceStateError extends Error {
  constructor(
    message: string,
    public readonly guildId?: string,
    public readonly userId?: string,
  ) {
    super(message);
    this.name = 'InvalidVoiceStateError';
  }
}

export class VoiceStateDto {
  constructor(
    public readonly guildId: string,
    public readonly userId: string,
    public readonly channelId: string,
    public readonly userName: string,
    public readonly channelName: string,
    public readonly parentCategoryId: string,
    public readonly micOn: boolean,
    public readonly alone: boolean,
  ) {}

  static fromVoiceState(state: VoiceState): VoiceStateDto {
    if (!state.guild || !state.member || !state.channelId || !state.channel?.parentId) {
      throw new InvalidVoiceStateError(
        `Invalid VoiceState: guild=${!!state.guild} member=${!!state.member} channelId=${state.channelId} parentId=${state.channel?.parentId}`,
        state.guild?.id,
        state.member?.id,
      );
    }

    return new VoiceStateDto(
      state.guild.id,
      state.member.id,
      state.channelId,
      state.member.displayName,
      state.channel.name,
      state.channel.parentId,
      !state.selfMute,
      state.channel.members.size === 1,
    );
  }
}
