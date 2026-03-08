import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { VoiceExcludedChannelType } from '../domain/voice-excluded-channel.entity';

class ExcludedChannelItem {
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsEnum(VoiceExcludedChannelType)
  type: VoiceExcludedChannelType;
}

export class VoiceExcludedChannelSyncDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExcludedChannelItem)
  channels: ExcludedChannelItem[];
}
