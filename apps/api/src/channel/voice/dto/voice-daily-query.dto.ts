import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VoiceDailyQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to: string;

  /** 특정 유저 필터. 미제공 시 전체 유저 조회 (F-VOICE-018) */
  @IsString()
  @IsOptional()
  userId?: string;

  /** IANA 타임존 (예: 'America/New_York'). 미제공 시 기본 KST 기준 조회 */
  @IsString()
  @IsOptional()
  timezone?: string;
}
