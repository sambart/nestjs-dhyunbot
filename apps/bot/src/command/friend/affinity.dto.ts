import { Choice, Param, ParamType } from '@discord-nestjs/core';

const PeriodChoices = { '7일': 7, '30일': 30, '90일': 90 } as const;

export class AffinityDto {
  @Param({
    name: 'user',
    description: '비교 대상 1 (필수)',
    required: true,
    type: ParamType.USER,
  })
  user: string;

  @Param({
    name: 'user2',
    description: '비교 대상 2 (생략 시 명령 실행자 본인)',
    required: false,
    type: ParamType.USER,
  })
  user2?: string;

  @Choice(PeriodChoices)
  @Param({
    name: 'period',
    description: '집계 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
  })
  period?: number;
}
