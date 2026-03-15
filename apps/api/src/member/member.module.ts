import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MemberOrmEntity } from './infrastructure/member.orm-entity';
import { MemberService } from './member.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemberOrmEntity])],
  providers: [MemberService],
  exports: [MemberService, TypeOrmModule],
})
export class MemberModule {}
