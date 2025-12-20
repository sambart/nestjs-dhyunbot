import { ApiProperty } from '@nestjs/swagger';

export class ChannelResponseDto {
  @ApiProperty({ example: 1, description: '채널 내부 ID' })
  id: number;

  @ApiProperty({ example: '123456789012345678', description: '디스코드 채널 ID' })
  discordChannelId: string;

  @ApiProperty({ example: '일반 음성 채널' })
  channelName: string;

  @ApiProperty({ example: 'VOICE', required: false })
  type?: string;

  @ApiProperty({ example: '2025-06-01T12:00:00.000Z' })
  createdAt: Date;
}
