import { Controller, Delete, HttpCode, HttpStatus, Logger, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../../auth/infrastructure/jwt-auth.guard';
import type { JwtUser } from '../../../common/types/jwt-user.types';
import { type DataDeletionResult, DataDeletionService } from '../application/data-deletion.service';

interface DeletedCountDto {
  deletedCount: DataDeletionResult;
}

@Controller('api/users/me')
@UseGuards(JwtAuthGuard)
export class DataDeletionController {
  private readonly logger = new Logger(DataDeletionController.name);

  constructor(private readonly dataDeletionService: DataDeletionService) {}

  /**
   * DELETE /api/users/me/data
   * 본인의 음성 활동 데이터를 전체 삭제한다 (GDPR 스타일 데이터 삭제권).
   */
  @Delete('data')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async deleteMyData(@Req() req: Request): Promise<DeletedCountDto> {
    const user = (req as unknown as { user: JwtUser }).user;
    const deletedCount = await this.dataDeletionService.deleteUserData(user.discordId);
    return { deletedCount };
  }
}
