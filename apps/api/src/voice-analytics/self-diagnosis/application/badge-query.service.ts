import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { VoiceHealthBadge } from '../domain/voice-health-badge.entity';

@Injectable()
export class BadgeQueryService {
  constructor(
    @InjectRepository(VoiceHealthBadge)
    private readonly badgeRepo: Repository<VoiceHealthBadge>,
  ) {}

  /**
   * 사용자가 보유한 뱃지 코드 목록을 조회한다.
   */
  async findBadgeCodes(guildId: string, userId: string): Promise<string[]> {
    const badge = await this.badgeRepo.findOne({
      where: { guildId, userId },
      select: ['badges'],
    });
    return badge?.badges ?? [];
  }
}
