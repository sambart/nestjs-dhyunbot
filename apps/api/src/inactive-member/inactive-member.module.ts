import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { VoiceDailyEntity } from '../channel/voice/domain/voice-daily.entity';
import { InactiveMemberScheduler } from './application/inactive-member.scheduler';
import { InactiveMemberService } from './application/inactive-member.service';
import { InactiveMemberActionService } from './application/inactive-member-action.service';
import { InactiveMemberActionLog } from './domain/inactive-member-action-log.entity';
import { InactiveMemberConfig } from './domain/inactive-member-config.entity';
import { InactiveMemberRecord } from './domain/inactive-member-record.entity';
import { InactiveMemberRepository } from './infrastructure/inactive-member.repository';
import { InactiveMemberQueryRepository } from './infrastructure/inactive-member-query.repository';
import { InactiveMemberController } from './presentation/inactive-member.controller';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([
      InactiveMemberConfig,
      InactiveMemberRecord,
      InactiveMemberActionLog,
      VoiceDailyEntity,
    ]),
    AuthModule,
  ],
  controllers: [InactiveMemberController],
  providers: [
    InactiveMemberRepository,
    InactiveMemberQueryRepository,
    InactiveMemberService,
    InactiveMemberActionService,
    InactiveMemberScheduler,
  ],
})
export class InactiveMemberModule {}
