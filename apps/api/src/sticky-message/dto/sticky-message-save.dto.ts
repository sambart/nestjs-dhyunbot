import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StickyMessageSaveDto {
  @IsOptional()
  @IsInt()
  id?: number | null;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsOptional()
  @IsString()
  embedTitle?: string | null;

  @IsOptional()
  @IsString()
  embedDescription?: string | null;

  @IsOptional()
  @IsString()
  embedColor?: string | null;

  @IsBoolean()
  enabled: boolean;

  @IsInt()
  sortOrder: number;
}
