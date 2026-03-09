import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Member } from '../../../member/member.entity';
import { VoiceDailyEntity } from '../domain/voice-daily.entity';
import { MemberSearchResultDto } from '../dto/member-search-result.dto';

@Injectable()
export class MemberSearchService {
  constructor(
    @InjectRepository(VoiceDailyEntity)
    private readonly voiceDailyRepo: Repository<VoiceDailyEntity>,
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
  ) {}

  async search(guildId: string, q: string): Promise<MemberSearchResultDto[]> {
    const rows = await this.voiceDailyRepo
      .createQueryBuilder('vd')
      .select('vd."userId"', 'userId')
      .addSelect('MIN(vd."userName")', 'userName')
      .where('vd."guildId" = :guildId', { guildId })
      .andWhere('vd."userName" ILIKE :q', { q: `%${q}%` })
      .groupBy('vd."userId"')
      .orderBy('MIN(vd."userName")', 'ASC')
      .limit(20)
      .getRawMany<{ userId: string; userName: string }>();

    return rows.map((r) => ({ userId: r.userId, userName: r.userName }));
  }

  async getProfile(
    userId: string,
  ): Promise<{ userId: string; userName: string; avatarUrl: string | null } | null> {
    const member = await this.memberRepo.findOne({
      where: { discordMemberId: userId },
    });
    if (!member) return null;
    return {
      userId: member.discordMemberId,
      userName: member.nickname,
      avatarUrl: member.avatarUrl ?? null,
    };
  }

  async getProfiles(
    userIds: string[],
  ): Promise<Record<string, { userName: string; avatarUrl: string | null }>> {
    if (userIds.length === 0) return {};
    const members = await this.memberRepo
      .createQueryBuilder('m')
      .where('m."discordMemberId" IN (:...userIds)', { userIds })
      .getMany();
    const result: Record<string, { userName: string; avatarUrl: string | null }> = {};
    for (const m of members) {
      result[m.discordMemberId] = {
        userName: m.nickname,
        avatarUrl: m.avatarUrl ?? null,
      };
    }
    return result;
  }
}
