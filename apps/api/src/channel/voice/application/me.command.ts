import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { AttachmentBuilder, CommandInteraction } from 'discord.js';

import { MeProfileService } from './me-profile.service';
import { ProfileCardRenderer } from './profile-card-renderer';

@Command({
  name: 'me',
  description: '내 프로필과 음성 활동을 확인합니다',
})
@Injectable()
export class MeCommand {
  private readonly logger = new Logger(MeCommand.name);

  constructor(
    private readonly meProfileService: MeProfileService,
    private readonly profileCardRenderer: ProfileCardRenderer,
  ) {}

  @Handler()
  async onMe(@InteractionEvent() interaction: CommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const days = 15;
      const profile = await this.meProfileService.getProfile(interaction.guildId, interaction.user.id, days);

      if (!profile) {
        await interaction.editReply({ content: `최근 ${days}일간 음성 채널 활동 기록이 없습니다.` });
        return;
      }

      const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
      const imageBuffer = await this.profileCardRenderer.render(
        profile,
        interaction.user.displayName,
        avatarUrl,
      );

      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

      await interaction.editReply({ files: [attachment] });
    } catch (error) {
      this.logger.error('Me command error:', error);
      await interaction.editReply({ content: '프로필 조회 중 오류가 발생했습니다.' });
    }
  }
}
