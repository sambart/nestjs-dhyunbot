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

  async findAll(): Promise<Member[]> {
    return await this.memberRepository.find();
  }

  async findOne(discordMemberId: string): Promise<Member> {
    const member = await this.memberRepository.findOne({
      where: { discordMemberId },
    });

    if (!member) {
      const newMember = this.memberRepository.create(member);
      return await this.memberRepository.save(newMember);
    }

    return member;
  }

  async create(member: Partial<Member>): Promise<Member> {
    const newMember = this.memberRepository.create(member);
    return await this.memberRepository.save(newMember);
  }

  async update(discordMemberId: string, member: Partial<Member>): Promise<Member> {
    await this.memberRepository.update(discordMemberId, member);
    return await this.findOne(discordMemberId);
  }

  async delete(id: number): Promise<void> {
    await this.memberRepository.delete(id);
  }

  async findOrCreateMember(memberId: string, a_nickName: string): Promise<Member> {
    let member = await this.memberRepository.findOne({
      where: { discordMemberId: memberId }, // 필요한 조건
    });

    if (!member) {
      member = this.memberRepository.create({
        discordMemberId: memberId,
        nickName: a_nickName,
      }); // 생성
      member = await this.memberRepository.save(member); // 저장
    }

    return member;
  }
}
