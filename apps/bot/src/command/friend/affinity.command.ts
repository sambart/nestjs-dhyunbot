import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { AffinityCardResponse } from '@onyu/bot-api-client';
import { BotApiClientService } from '@onyu/bot-api-client';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
} from 'discord.js';

import { AffinityDto } from './affinity.dto';

// 기간 기본값 (일)
const DEFAULT_PERIOD = 30;
// 대시보드 URL
const WEB_URL = process.env['WEB_URL'] ?? 'https://onyu.app';
// 지원하는 기간 선택지
const VALID_PERIODS: ReadonlyArray<7 | 30 | 90> = [7, 30, 90];

// period choices 타입 가드
function isValidPeriod(value: number): value is 7 | 30 | 90 {
  return (VALID_PERIODS as readonly number[]).includes(value);
}

@Command({
  name: 'affinity',
  nameLocalizations: { ko: '친밀도' },
  description: 'Show two-user affinity card',
  descriptionLocalizations: { ko: '두 사람의 친밀도를 카드로 보여줍니다' },
})
@Injectable()
export class AffinityCommand {
  private readonly logger = new Logger(AffinityCommand.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @Handler()
  async onAffinity(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe) dto: AffinityDto,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: '서버에서만 사용 가능한 명령어입니다.', ephemeral: true });
      return;
    }

    // 옵션에서 유저 ID 추출 (SlashCommandPipe는 USER 타입을 ID string으로 전달)
    const userAId = interaction.options.get('user', true).value as string;
    const userBRaw = interaction.options.get('user2')?.value;
    const userBId = typeof userBRaw === 'string' ? userBRaw : interaction.user.id;

    // 동일 유저 중복 지정 사전 차단
    if (userAId === userBId) {
      await interaction.reply({
        content: '같은 사용자 두 명을 비교할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const rawPeriod = dto.period ?? DEFAULT_PERIOD;
    const period = isValidPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD;

    try {
      const result = await this.apiClient.getAffinity(
        interaction.guildId,
        userAId,
        userBId,
        period,
        interaction.user.id,
      );

      await this.handleResponse(interaction, result, interaction.guildId);
    } catch (error) {
      this.logger.error(
        'Affinity command error',
        error instanceof Error ? error.stack : String(error),
      );
      await interaction.editReply({ content: '친밀도 조회 중 오류가 발생했습니다.' });
    }
  }

  private buildLinkButtonRow(guildId: string): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
      .setLabel('대시보드에서 그래프 보기')
      .setStyle(ButtonStyle.Link)
      .setURL(`${WEB_URL}/dashboard/guild/${guildId}/co-presence`);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  }

  private async handleErrorCode(
    interaction: ChatInputCommandInteraction,
    errorCode: string,
    days: number,
  ): Promise<boolean> {
    if (errorCode === 'PRIVATE') {
      await interaction.editReply({
        content: '비공개 설정된 사용자가 포함되어 있습니다.',
      });
      return true;
    }
    if (errorCode === 'NOT_PERMITTED') {
      await interaction.editReply({
        content: '관리자만 조회 가능합니다. 길드 설정에서 공개로 변경할 수 있습니다.',
      });
      return true;
    }
    if (errorCode === 'NO_DATA') {
      await interaction.editReply({
        content: `최근 ${days}일간 두 분의 함께한 음성 기록이 없어요.`,
      });
      return true;
    }
    return false;
  }

  private async renderCard(
    interaction: ChatInputCommandInteraction,
    result: AffinityCardResponse,
    guildId: string,
  ): Promise<void> {
    if (!result.data) {
      return;
    }
    const imageBuffer = Buffer.from(result.data.imageBase64, 'base64');
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'affinity.png' });
    const linkButtonRow = this.buildLinkButtonRow(guildId);

    await interaction.editReply({
      files: [attachment],
      components: [linkButtonRow],
    });
  }

  private async handleResponse(
    interaction: ChatInputCommandInteraction,
    result: AffinityCardResponse,
    guildId: string,
  ): Promise<void> {
    // errorCode가 있으면 에러 분기 처리
    if (result.errorCode) {
      const isHandled = await this.handleErrorCode(interaction, result.errorCode, result.days);
      if (isHandled) {
        return;
      }
    }

    // 데이터 없음 (errorCode 없이 null인 경우)
    if (!result.data) {
      await interaction.editReply({
        content: `최근 ${result.days}일간 두 분의 함께한 음성 기록이 없어요.`,
      });
      return;
    }

    // 정상 카드 렌더링
    await this.renderCard(interaction, result, guildId);
  }
}
