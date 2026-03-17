import { Param, ParamType } from '@discord-nestjs/core';

export class AnalyticsDaysDto {
  @Param({
    name: 'days',
    description: '분석할 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
    minValue: 1,
    maxValue: 90,
  })
  days: number = 7;
}
