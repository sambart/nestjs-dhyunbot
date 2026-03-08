import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

/** 안내 메시지 전송/수정에 사용하는 버튼 페이로드 */
export interface GuideMessageButtonPayload {
  id: number;
  label: string;
  emoji: string | null;
}

/** Discord 버튼 제약: ActionRow당 최대 버튼 수 */
const BUTTONS_PER_ROW = 5;

@Injectable()
export class AutoChannelDiscordGateway {
  private readonly logger = new Logger(AutoChannelDiscordGateway.name);

  constructor(@InjectDiscordClient() private readonly client: Client) {}

  /**
   * F-VOICE-009: 텍스트 채널에 안내 메시지 + 버튼 신규 전송.
   * 반환값: Discord message ID
   */
  async sendGuideMessage(
    channelId: string,
    guideMessage: string,
    embedTitle: string | null,
    embedColor: string | null,
    buttons: GuideMessageButtonPayload[],
  ): Promise<string> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text-based channel`);
    }

    const embed = this.buildEmbed(guideMessage, embedTitle, embedColor);
    const components = this.buildActionRows(buttons);
    const message = await (channel as TextChannel).send({
      embeds: [embed],
      components,
    });

    return message.id;
  }

  /**
   * F-VOICE-009: 기존 안내 메시지 수정.
   * 실패 시 (메시지 삭제됨 등) null 반환 — 호출자가 신규 전송으로 폴백.
   */
  async editGuideMessage(
    channelId: string,
    messageId: string,
    guideMessage: string,
    embedTitle: string | null,
    embedColor: string | null,
    buttons: GuideMessageButtonPayload[],
  ): Promise<string | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const message = await (channel as TextChannel).messages.fetch(messageId);
      const embed = this.buildEmbed(guideMessage, embedTitle, embedColor);
      const components = this.buildActionRows(buttons);

      await message.edit({
        embeds: [embed],
        components,
      });

      return messageId;
    } catch (error) {
      this.logger.warn(
        `Failed to edit guide message (channelId=${channelId}, messageId=${messageId}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 안내 메시지 삭제.
   * 실패 시 (메시지 이미 삭제됨 등) 오류를 무시한다.
   */
  async deleteGuideMessage(channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return;

      const message = await (channel as TextChannel).messages.fetch(messageId);
      await message.delete();
    } catch (error) {
      this.logger.warn(
        `Failed to delete guide message (channelId=${channelId}, messageId=${messageId}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * 서버 내 음성 채널 이름 목록 조회.
   * 단위 B (버튼-확정방)에서 중복 채널명 순번 처리용으로 사용.
   */
  async fetchGuildVoiceChannelNames(guildId: string): Promise<string[]> {
    const guild = await this.client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    return channels
      .filter((ch) => ch?.isVoiceBased() ?? false)
      .map((ch) => ch!.name);
  }

  /**
   * 안내 메시지용 Embed 생성.
   */
  private buildEmbed(
    description: string,
    title: string | null,
    color: string | null,
  ): EmbedBuilder {
    const embed = new EmbedBuilder();
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (color) embed.setColor(color as `#${string}`);
    return embed;
  }

  /**
   * 버튼 페이로드 목록을 Discord ActionRow 컴포넌트 배열로 변환.
   * Discord 제약: ActionRow 최대 5개, 버튼 최대 5개/행 → 총 25개.
   * customId 형식: auto_btn:{buttonId}
   */
  private buildActionRows(
    buttons: GuideMessageButtonPayload[],
  ): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
      const rowButtons = buttons.slice(i, i + BUTTONS_PER_ROW);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        rowButtons.map((btn) => {
          const builder = new ButtonBuilder()
            .setCustomId(`auto_btn:${btn.id}`)
            .setLabel(btn.label)
            .setStyle(ButtonStyle.Primary);

          if (btn.emoji && btn.emoji.trim()) {
            try {
              builder.setEmoji(btn.emoji.trim());
            } catch {
              // 유효하지 않은 이모지 무시
            }
          }

          return builder;
        }),
      );
      rows.push(row);
    }

    return rows;
  }
}
