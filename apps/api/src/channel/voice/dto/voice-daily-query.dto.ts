import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VoiceDailyQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'from은 YYYYMMDD 형식이어야 합니다' })
  from: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}$/, { message: 'to는 YYYYMMDD 형식이어야 합니다' })
  to: string;
}
