import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class MissionCompleteDto {
  @IsInt()
  missionId: number;

  @IsOptional()
  @IsString()
  roleId?: string | null;
}

export class MissionFailDto {
  @IsInt()
  missionId: number;

  @IsOptional()
  @IsBoolean()
  kick?: boolean;

  @IsOptional()
  @IsString()
  dmReason?: string | null;
}

export class MissionHideDto {
  @IsInt()
  missionId: number;
}
