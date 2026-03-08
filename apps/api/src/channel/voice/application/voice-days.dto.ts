import { Param, ParamType } from '@discord-nestjs/core';

export class VoiceDaysDto {
  @Param({
    name: 'days',
    description: '조회할 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
    minValue: 1,
    maxValue: 90,
  })
  days: number = 7;
}
