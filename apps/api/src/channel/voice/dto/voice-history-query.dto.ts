import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class VoiceHistoryQueryDto {
  /** 조회 시작 날짜 (YYYYMMDD, 선택) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from?: string;

  /** 조회 종료 날짜 (YYYYMMDD, 선택) */
  @IsString()
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to?: string;

  /** 페이지 번호 (1부터 시작, 기본값: 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** 페이지당 항목 수 (기본값: 20, 최대: 100) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
