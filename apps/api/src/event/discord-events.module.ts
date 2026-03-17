import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';

import { AutoChannelModule } from '../channel/auto/auto-channel.module';
import { ChannelModule } from '../channel/channel.module';
import { VoiceChannelModule } from '../channel/voice/voice-channel.module';
import { NewbieModule } from '../newbie/newbie.module';
import { StatusPrefixModule } from '../status-prefix/status-prefix.module';
import { StickyMessageModule } from '../sticky-message/sticky-message.module';
import { ChannelStateHandler } from './channel/channel-state.handler';
import { NewbieInteractionHandler } from './newbie/newbie-interaction.handler';
import { NewbieMemberAddHandler } from './newbie/newbie-member-add.handler';
import { StickyMessageHandler } from './sticky-message/sticky-message.handler';
import { VoiceAloneHandler } from './voice/voice-alone.handler';
import { VoiceJoinHandler } from './voice/voice-join.handler';
import { VoiceLeaveHandler } from './voice/voice-leave.handler';
import { MicToggleHandler } from './voice/voice-mic-toggle.handler';
import { VoiceMoveHandler } from './voice/voice-move.handler';
import { VoiceStateDispatcher } from './voice/voice-state.dispatcher';

@Module({
  imports: [
    AutoChannelModule,
    ChannelModule,
    VoiceChannelModule,
    NewbieModule,
    StatusPrefixModule,
    StickyMessageModule,
    DiscordModule.forFeature(),
  ],
  providers: [
    ChannelStateHandler,
    VoiceStateDispatcher,
    VoiceJoinHandler,
    VoiceLeaveHandler,
    VoiceMoveHandler,
    MicToggleHandler,
    VoiceAloneHandler,
    NewbieInteractionHandler,
    NewbieMemberAddHandler,
    StickyMessageHandler,
  ],
})
export class DiscordEventsModule {}
