import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MemberModule } from '../../member/member.module';
import { ChannelModule } from '../channel.module';
import { VoiceChannelPolicy } from './application/voice-channel.policy';
import { VoiceChannelService } from './application/voice-channel.service';
import { VoiceChannelHistoryService } from './application/voice-channel-history.service';
import { VoiceDailyFlushService } from './application/voice-daily-flush-service';
import { VoiceExcludedChannelService } from './application/voice-excluded-channel.service';
import { VoiceFlushCommand } from './application/voice-flush.command';
import { VoiceRankCommand } from './application/voice-rank.command';
import { VoiceRecoveryService } from './application/voice-recovery.service';
import { VoiceSessionService } from './application/voice-session.service';
import { VoiceStatsQueryService } from './application/voice-stats-query.service';
import { VoiceTempChannelService } from './application/voice-temp-channel.service';
import { VoiceTimeCommand } from './application/voice-time.command';
import { VoiceChannelHistory } from './domain/voice-channel-history.entity';
import { VoiceDailyEntity } from './domain/voice-daily.entity';
import { VoiceExcludedChannel } from './domain/voice-excluded-channel.entity';
import { DiscordVoiceGateway } from './infrastructure/discord-voice.gateway';
import { RedisTempChannelStore } from './infrastructure/redis-temp-channel-store';
import { VoiceDailyRepository } from './infrastructure/voice-daily.repository';
import { VoiceExcludedChannelRepository } from './infrastructure/voice-excluded-channel.repository';
import { VoiceRedisRepository } from './infrastructure/voice-redis.repository';
import { VoiceExcludedChannelController } from './presentation/voice-excluded-channel.controller';

@Module({
  imports: [
    DiscordModule.forFeature(),
    TypeOrmModule.forFeature([VoiceChannelHistory, VoiceDailyEntity, VoiceExcludedChannel]),
    MemberModule,
    ChannelModule,
  ],
  controllers: [VoiceExcludedChannelController],
  providers: [
    VoiceChannelService,
    VoiceSessionService,
    VoiceTempChannelService,
    VoiceChannelHistoryService,
    VoiceChannelPolicy,
    DiscordVoiceGateway,
    {
      provide: 'TempChannelStore',
      useClass: RedisTempChannelStore,
    },
    VoiceRedisRepository,
    VoiceDailyRepository,
    VoiceDailyFlushService,
    VoiceFlushCommand,
    VoiceRecoveryService,
    VoiceStatsQueryService,
    VoiceTimeCommand,
    VoiceRankCommand,
    VoiceExcludedChannelRepository,
    VoiceExcludedChannelService,
  ],
  exports: [
    VoiceChannelService,
    VoiceSessionService,
    VoiceDailyFlushService,
    VoiceRedisRepository,
    DiscordVoiceGateway,
    TypeOrmModule,
    VoiceExcludedChannelService,
  ],
})
export class VoiceChannelModule {}
