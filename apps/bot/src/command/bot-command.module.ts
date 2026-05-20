import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AffinityCommand } from './friend/affinity.command';
import { BestFriendCommand } from './friend/best-friend.command';
import { MeCommand } from './me.command';
import { PrivacyCommand } from './privacy/privacy.command';
import { StickyMessageDeleteCommand } from './sticky-message/sticky-message-delete.command';
import { StickyMessageListCommand } from './sticky-message/sticky-message-list.command';
import { StickyMessageRegisterCommand } from './sticky-message/sticky-message-register.command';
import { VersionCommand } from './version.command';
import { SelfDiagnosisCommand } from './voice-analytics/self-diagnosis.command';
import { ServerDiagnosisCommand } from './voice-analytics/server-diagnosis.command';
import { VoiceFlushCommand } from './voice-flush.command';

/**
 * Bot 슬래시 커맨드 모듈.
 * API에서 이동된 커맨드들을 등록한다.
 */
@Module({
  imports: [DiscordModule.forFeature()],
  providers: [
    VersionCommand,
    VoiceFlushCommand,
    StickyMessageRegisterCommand,
    StickyMessageDeleteCommand,
    StickyMessageListCommand,
    // Voice Analytics
    SelfDiagnosisCommand,
    ServerDiagnosisCommand,
    // Me
    MeCommand,
    // Phase 5: 친밀도/베프
    BestFriendCommand,
    AffinityCommand,
    // Phase 5: 사생활
    PrivacyCommand,
  ],
})
export class BotCommandModule {}
