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

  async findOne(discordUserId: string): Promise<Member> {
    const member = await this.memberRepository.findOne({
      where: { discordUserId },
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

  async update(discordUserId: string, member: Partial<Member>): Promise<Member> {
    await this.memberRepository.update(discordUserId, member);
    return await this.findOne(discordUserId);
  }

  async delete(id: number): Promise<void> {
    await this.memberRepository.delete(id);
  }
}
