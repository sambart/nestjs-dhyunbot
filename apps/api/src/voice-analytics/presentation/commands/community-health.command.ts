import { splitByLines, truncate } from '@dhyunbot/shared';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Colors, CommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

import { BotI18nService } from '../../../common/application/bot-i18n.service';
import { LocaleResolverService } from '../../../common/application/locale-resolver.service';
import { VoiceAiAnalysisService } from '../../application/voice-ai-analysis.service';
import { VoiceAnalyticsService } from '../../application/voice-analytics.service';
import { AnalyticsDaysDto } from './analytics-days.dto';

@Command({
  name: 'community-health',
  description: 'Diagnose server community health with AI',
  nameLocalizations: { ko: '커뮤니티건강도' },
  descriptionLocalizations: { ko: '서버 커뮤니티의 건강도를 AI로 진단합니다' },
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@Injectable()
export class CommunityHealthCommand {
  private readonly logger = new Logger(CommunityHealthCommand.name);

  constructor(
    private readonly aiAnalysisService: VoiceAiAnalysisService,
    private readonly analyticsService: VoiceAnalyticsService,
    private readonly i18n: BotI18nService,
    private readonly localeResolver: LocaleResolverService,
  ) {}

  @Handler()
  async onCommunityHealth(
    @InteractionEvent() interaction: CommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AnalyticsDaysDto,
  ): Promise<void> {
    const locale = await this.localeResolver.resolve(
      interaction.user.id,
      interaction.guildId,
      interaction.locale,
    );

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: this.i18n.t(locale, 'errors.adminOnly'),
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply(this.i18n.t(locale, 'errors.guildOnly'));
        return;
      }

      const days = dto.days;
      const { start, end } = VoiceAnalyticsService.getDateRange(days);
      const activityData = await this.analyticsService.collectVoiceActivityData(
        guildId,
        start,
        end,
      );

      if (activityData.userActivities.length === 0) {
        await interaction.editReply({
          content: this.i18n.t(locale, 'voice.communityHealthNoData'),
        });
        return;
      }

      const healthText = await this.aiAnalysisService.calculateCommunityHealth(activityData);

      const MAX_EMBED_DESCRIPTION = 4096;
      const needsSplit = healthText.length > MAX_EMBED_DESCRIPTION;
      const overflowSuffix = this.i18n.t(locale, 'voice.communityHealthAnalysisOverflow');

      const embed = new EmbedBuilder()
        .setTitle(this.i18n.t(locale, 'voice.communityHealthTitle'))
        .setColor(Colors.Blue)
        .setDescription(
          needsSplit
            ? truncate(healthText, MAX_EMBED_DESCRIPTION - 80) + overflowSuffix
            : healthText,
        )
        .addFields({
          name: this.i18n.t(locale, 'voice.communityHealthFieldPeriod'),
          value: this.i18n.t(locale, 'voice.communityHealthPeriodValue', { days }),
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: this.i18n.t(locale, 'voice.communityHealthFooter') });

      await interaction.editReply({ embeds: [embed] });

      if (needsSplit) {
        const chunks = splitByLines(healthText, 1900);
        for (const chunk of chunks) {
          await interaction.followUp({ content: chunk, ephemeral: false });
        }
      }
    } catch (error) {
      this.logger.error('Community health command error:', error);
      await interaction.editReply({
        content: this.i18n.t(locale, 'voice.communityHealthError'),
      });
    }
  }
}
