import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Member } from './member.entity';

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async findOne(discordMemberId: string): Promise<Member | null> {
    return this.memberRepository.findOne({
      where: { discordMemberId },
    });
  }

  async findOrCreateMember(memberId: string, nickname: string): Promise<Member> {
    let member = await this.memberRepository.findOne({
      where: { discordMemberId: memberId },
    });

    if (!member) {
      member = this.memberRepository.create({
        discordMemberId: memberId,
        nickname: nickname || 'unknown',
      });
      member = await this.memberRepository.save(member);
    }

    return member;
  }
}
