import { Inject, Injectable, Logger } from '@nestjs/common';

import { DiscordVoiceGateway } from '../infrastructure/discord-voice.gateway';
import { TempChannelStore } from '../infrastructure/temp-channel-store';
import { VoiceStateDto } from '../infrastructure/voice-state.dto';
import { VoiceChannelPolicy } from './voice-channel.policy';

@Injectable()
export class VoiceTempChannelService {
  private readonly logger = new Logger(VoiceTempChannelService.name);

  constructor(
    @Inject('TempChannelStore') private readonly tempChannelStore: TempChannelStore,
    private readonly policy: VoiceChannelPolicy,
    private readonly discord: DiscordVoiceGateway,
  ) {}

  async handleJoin(cmd: VoiceStateDto): Promise<void> {
    if (this.policy.shouldCreateTempChannel(cmd.channelId)) {
      const tempChannelId = await this.discord.createVoiceChannel({
        guildId: cmd.guildId,
        name: '임시',
        parentCategoryId: cmd.parentCategoryId,
      });

      await this.tempChannelStore.registerTempChannel(cmd.guildId, tempChannelId);
      await this.tempChannelStore.addMember(tempChannelId, cmd.userId);
      await this.discord.moveUserToChannel(cmd.guildId, cmd.userId, tempChannelId);

      this.logger.log(`[TEMP CHANNEL] Created ${tempChannelId} for ${cmd.userId}`);
    }
  }

  async handleLeave(cmd: VoiceStateDto): Promise<void> {
    if (
      cmd.channelId &&
      (await this.policy.shouldDeleteChannel(cmd.guildId, cmd.channelId))
    ) {
      await this.tempChannelStore.removeMember(cmd.channelId, cmd.userId);
      await this.tempChannelStore.unregisterTempChannel(cmd.guildId, cmd.channelId);
      await this.discord.deleteChannel(cmd.channelId);

      this.logger.log(`[TEMP CHANNEL] Deleted ${cmd.channelId}`);
    }
  }
}
