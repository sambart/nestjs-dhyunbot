import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { CommandInteraction, PermissionFlagsBits } from 'discord.js';

import { VoiceDailyFlushService } from './voice-daily-flush-service';

@Command({
  name: 'voice-flush',
  description: '음성 채널 집계 데이터를 강제로 DB에 반영합니다 (관리자 전용)',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class VoiceFlushCommand {
  private readonly logger = new Logger(VoiceFlushCommand.name);

  constructor(private readonly flushService: VoiceDailyFlushService) {}

  @Handler()
  async onVoiceFlush(@InteractionEvent() interaction: CommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { flushed, skipped } = await this.flushService.safeFlushAll();

      await interaction.editReply({
        content: `집계 완료: ${flushed}개 세션 반영, ${skipped}개 스킵`,
      });

      this.logger.log(`[VOICE FLUSH] by ${interaction.user.tag} — flushed=${flushed} skipped=${skipped}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      await interaction.editReply({ content: `집계 실패: ${message}` });
    }
  }
}
