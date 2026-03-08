import { VoiceStateDto } from '../../channel/voice/infrastructure/voice-state.dto';

export const VOICE_EVENTS = {
  JOIN: 'voice.join',
  LEAVE: 'voice.leave',
  MOVE: 'voice.move',
  MIC_TOGGLE: 'voice.mic-toggle',
  ALONE_CHANGED: 'voice.alone-changed',
} as const;

export class VoiceJoinEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class VoiceLeaveEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class VoiceMoveEvent {
  constructor(
    public readonly oldState: VoiceStateDto,
    public readonly newState: VoiceStateDto,
  ) {}
}

export class VoiceMicToggleEvent {
  constructor(public readonly state: VoiceStateDto) {}
}

export class VoiceAloneChangedEvent {
  constructor(
    public readonly guildId: string,
    public readonly memberIds: string[],
    public readonly isAlone: boolean,
  ) {}
}
