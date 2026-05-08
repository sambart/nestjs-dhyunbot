import { Choice, Param, ParamType } from '@discord-nestjs/core';

const PeriodChoices = { '7일': 7, '30일': 30, '90일': 90 } as const;

export class BestFriendDto {
  @Choice(PeriodChoices)
  @Param({
    name: 'period',
    description: '집계 기간 (일)',
    required: false,
    type: ParamType.INTEGER,
  })
  period?: number;

  @Param({
    name: 'limit',
    description: 'TOP N 명 (3~5)',
    required: false,
    type: ParamType.INTEGER,
    minValue: 3,
    maxValue: 5,
  })
  limit?: number;

  @Param({
    name: 'private',
    description: 'true이면 본인만 볼 수 있는 비공개 응답',
    required: false,
    type: ParamType.BOOLEAN,
  })
  private?: boolean;
}
