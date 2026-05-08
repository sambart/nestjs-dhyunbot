import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import type { JwtUser } from '../../common/types/jwt-user.types';
import { UserPrivacyConfigService } from '../application/user-privacy-config.service';
import type { UserPrivacyDto } from '../dto/user-privacy.dto';
import { UpdateUserPrivacyDto } from '../dto/user-privacy.dto';

@Controller('api/users/me/privacy')
@UseGuards(JwtAuthGuard)
export class UserPrivacyController {
  constructor(private readonly userPrivacyService: UserPrivacyConfigService) {}

  @Get()
  async getMyPrivacy(
    @Query('guildId') guildId: string,
    @Req() req: Request,
  ): Promise<UserPrivacyDto> {
    // JwtAuthGuard가 주입한 JwtUser 타입 단언
    const user = (req as unknown as { user: JwtUser }).user;
    const { disableRelationshipShare } = await this.userPrivacyService.getOne(
      guildId,
      user.discordId,
    );

    return { guildId, userId: user.discordId, disableRelationshipShare };
  }

  @Put()
  async updateMyPrivacy(
    @Query('guildId') guildId: string,
    @Body() dto: UpdateUserPrivacyDto,
    @Req() req: Request,
  ): Promise<UserPrivacyDto> {
    if (dto.guildId !== guildId) {
      throw new BadRequestException('query guildId와 body guildId가 일치하지 않습니다.');
    }

    // JwtAuthGuard가 주입한 JwtUser 타입 단언
    const user = (req as unknown as { user: JwtUser }).user;
    await this.userPrivacyService.upsert(guildId, user.discordId, dto.disableRelationshipShare);

    return {
      guildId,
      userId: user.discordId,
      disableRelationshipShare: dto.disableRelationshipShare,
    };
  }
}
