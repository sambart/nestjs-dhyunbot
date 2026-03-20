import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { NewbiePeriodOrmEntity as NewbiePeriod } from './newbie-period.orm-entity';

@Injectable()
export class NewbiePeriodRepository {
  constructor(
    @InjectRepository(NewbiePeriod)
    private readonly repo: Repository<NewbiePeriod>,
  ) {}

  /** 신입기간 레코드 생성 */
  async create(
    guildId: string,
    memberId: string,
    startDate: string,
    expiresDate: string,
  ): Promise<NewbiePeriod> {
    const period = this.repo.create({
      guildId,
      memberId,
      startDate,
      expiresDate,
      isExpired: false,
    });
    return this.repo.save(period);
  }

  /**
   * 길드의 미만료 신입기간 레코드 전체 조회 (캐시 워밍업용)
   * IDX_newbie_period_guild_active 인덱스 활용
   */
  async findActiveByGuild(guildId: string): Promise<NewbiePeriod[]> {
    return this.repo.find({ where: { guildId, isExpired: false } });
  }

  /**
   * 특정 멤버의 활성 신입기간 조회 (단건)
   * IDX_newbie_period_guild_member 인덱스 활용
   */
  async findActiveMemberByGuild(guildId: string, memberId: string): Promise<NewbiePeriod | null> {
    return this.repo.findOne({ where: { guildId, memberId, isExpired: false } });
  }

  /**
   * 만료된 활성 레코드 조회 (스케줄러용)
   * IDX_newbie_period_expires 인덱스 활용
   * today는 YYYYMMDD 형식 문자열
   */
  async findExpired(today: string): Promise<NewbiePeriod[]> {
    return this.repo.find({
      where: { isExpired: false, expiresDate: LessThan(today) },
    });
  }

  /** isExpired = true 로 갱신 */
  async markExpired(id: number): Promise<void> {
    await this.repo.update(id, { isExpired: true });
  }
}
