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

  async findOrCreateMember(memberId: string, a_nickName: string): Promise<Member> {
    let member = await this.memberRepository.findOne({
      where: { discordMemberId: memberId }, // 필요한 조건
    });

    if (!member) {
      member = this.memberRepository.create({
        discordMemberId: memberId,
        nickName: a_nickName || 'unknown',
      }); // 생성
      member = await this.memberRepository.save(member); // 저장
    }

    return member;
  }
}
