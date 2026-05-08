import { Param, ParamType } from '@discord-nestjs/core';

export class PrivacyDto {
  @Param({
    name: 'relationship-share',
    description: '친밀도 공개 여부 (true=공개 / false=비공개)',
    required: true,
    type: ParamType.BOOLEAN,
  })
  relationshipShare: boolean;
}
