import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { MeCommand } from './me.command';
import { StickyMessageDeleteCommand } from './sticky-message/sticky-message-delete.command';
import { StickyMessageListCommand } from './sticky-message/sticky-message-list.command';
import { StickyMessageRegisterCommand } from './sticky-message/sticky-message-register.command';
import { VersionCommand } from './version.command';
import { CommunityHealthCommand } from './voice-analytics/community-health.command';
import { MyVoiceStatsCommand } from './voice-analytics/my-voice-stats.command';
import { SelfDiagnosisCommand } from './voice-analytics/self-diagnosis.command';
import { VoiceLeaderboardCommand } from './voice-analytics/voice-leaderboard.command';
import { VoiceStatsCommand } from './voice-analytics/voice-stats.command';
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
    MyVoiceStatsCommand,
    VoiceLeaderboardCommand,
    VoiceStatsCommand,
    CommunityHealthCommand,
    SelfDiagnosisCommand,
    // Me
    MeCommand,
  ],
})
export class BotCommandModule {}
