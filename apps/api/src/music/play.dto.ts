import { Param } from '@discord-nestjs/core';
import { Transform } from 'class-transformer';

export class PlayDto {
  // @Transform(({ value }) => value.toUpperCase())
  @Param({
    name: '노래',
    description: 'YouTube URL 또는 검색어를 입력하면 재생합니다.',
    required: true,
  })
  url: string;
}
