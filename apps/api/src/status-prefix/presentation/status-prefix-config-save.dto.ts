import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { StatusPrefixButtonType } from '../domain/status-prefix-button.entity';

export class StatusPrefixButtonSaveDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  emoji?: string | null;

  @IsOptional()
  @IsString()
  prefix?: string | null;

  @IsEnum(StatusPrefixButtonType)
  type: StatusPrefixButtonType;

  @IsInt()
  sortOrder: number;
}

export class StatusPrefixConfigSaveDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  channelId?: string | null;

  @IsOptional()
  @IsString()
  embedTitle?: string | null;

  @IsOptional()
  @IsString()
  embedDescription?: string | null;

  @IsOptional()
  @IsString()
  embedColor?: string | null;

  @IsString()
  @IsNotEmpty()
  prefixTemplate: string;

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => StatusPrefixButtonSaveDto)
  buttons: StatusPrefixButtonSaveDto[];
}
