import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.entity';

export class VoiceExcludedChannelSaveDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsEnum(VoiceExcludedChannelType)
  type: VoiceExcludedChannelType;
}
