import { Module } from '@nestjs/common';
import { ChannelStateHandler } from './channel/channel-state.handler';
import { ChannelModule } from 'src/channel/channel.module';
import { DiscordModule } from '@discord-nestjs/core';
import { VoiceChannelModule } from 'src/channel/voice/voice-channel.module';
import { DiscordConfig } from 'src/config/discord.config';
import { VoiceStateDispatcher } from './voice/voice-state.dispatcher';
import { VoiceJoinHandler } from './voice/voice-join.handler';
import { VoiceLeaveHandler } from './voice/voice-leave.handler';
import { VoiceMoveHandler } from './voice/voice-move.handler';
import { MicToggleHandler } from './voice/voice-mic-toggle.handler';

@Module({
  imports: [
    ChannelModule,
    VoiceChannelModule,
    DiscordModule.forRootAsync(DiscordConfig),
    DiscordModule.forFeature(),
  ],
  providers: [
    ChannelStateHandler,
    VoiceStateDispatcher,
    VoiceJoinHandler,
    VoiceLeaveHandler,
    VoiceMoveHandler,
    MicToggleHandler,
  ],
})
export class DiscordEventsModule {}
