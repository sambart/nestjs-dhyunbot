import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AutoChannelSubOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsString()
  @IsNotEmpty()
  channelSuffix: string;

  @IsInt()
  sortOrder: number;
}

export class AutoChannelButtonDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsString()
  @IsNotEmpty()
  targetCategoryId: string;

  @IsOptional()
  @IsString()
  channelNameTemplate?: string;

  @IsInt()
  sortOrder: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoChannelSubOptionDto)
  subOptions: AutoChannelSubOptionDto[];
}

export class AutoChannelSaveDto {
  @IsString()
  @IsNotEmpty()
  triggerChannelId: string;

  @IsString()
  @IsNotEmpty()
  guideChannelId: string;

  @IsOptional()
  @IsString()
  waitingRoomTemplate?: string;

  @IsString()
  @IsNotEmpty()
  guideMessage: string;

  @IsOptional()
  @IsString()
  embedTitle?: string;

  @IsOptional()
  @IsString()
  embedColor?: string;

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => AutoChannelButtonDto)
  buttons: AutoChannelButtonDto[];
}
