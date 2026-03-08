import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { MissionStatus, NewbieMission } from '../domain/newbie-mission.entity';

@Injectable()
export class NewbieMissionRepository {
  constructor(
    @InjectRepository(NewbieMission)
    private readonly repo: Repository<NewbieMission>,
  ) {}

  /** 미션 레코드 생성 */
  async create(
    guildId: string,
    memberId: string,
    startDate: string,
    endDate: string,
    targetPlaytimeSec: number,
  ): Promise<NewbieMission> {
    const mission = this.repo.create({
      guildId,
      memberId,
      startDate,
      endDate,
      targetPlaytimeSec,
      status: MissionStatus.IN_PROGRESS,
    });
    return this.repo.save(mission);
  }

  /**
   * 길드의 IN_PROGRESS 미션 목록 조회
   * IDX_newbie_mission_guild_status 인덱스 활용
   */
  async findActiveByGuild(guildId: string): Promise<NewbieMission[]> {
    return this.repo.find({ where: { guildId, status: MissionStatus.IN_PROGRESS } });
  }

  /**
   * 멤버의 IN_PROGRESS 미션 조회 (단건)
   * IDX_newbie_mission_guild_member 인덱스 활용
   */
  async findActiveByMember(guildId: string, memberId: string): Promise<NewbieMission | null> {
    return this.repo.findOne({
      where: { guildId, memberId, status: MissionStatus.IN_PROGRESS },
    });
  }

  /**
   * 만료된 IN_PROGRESS 미션 전체 조회
   * IDX_newbie_mission_status_end_date 인덱스 활용
   * today는 YYYYMMDD 형식 문자열
   */
  async findExpired(today: string): Promise<NewbieMission[]> {
    return this.repo.find({
      where: { status: MissionStatus.IN_PROGRESS, endDate: LessThan(today) },
    });
  }

  /** 미션 상태 갱신 (COMPLETED / FAILED) */
  async updateStatus(id: number, status: MissionStatus): Promise<void> {
    await this.repo.update(id, { status });
  }

  /** 미션 레코드 삭제 */
  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  /**
   * 길드의 미션 상태별 카운트 집계.
   * headerTemplate의 {inProgressCount}, {completedCount}, {failedCount} 변수 렌더링에 사용.
   */
  async countByStatusForGuild(guildId: string): Promise<Record<MissionStatus, number>> {
    const rows = await this.repo
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('m.guildId = :guildId', { guildId })
      .groupBy('m.status')
      .getRawMany<{ status: MissionStatus; count: string }>();

    const result: Record<MissionStatus, number> = {
      [MissionStatus.IN_PROGRESS]: 0,
      [MissionStatus.COMPLETED]: 0,
      [MissionStatus.FAILED]: 0,
    };
    for (const row of rows) {
      result[row.status] = parseInt(row.count, 10);
    }
    return result;
  }
}
