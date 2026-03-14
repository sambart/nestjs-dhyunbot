import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';

import { NewbieConfig } from '../domain/newbie-config.entity';

@Injectable()
export class WelcomeService {
  private readonly logger = new Logger(WelcomeService.name);

  constructor(@InjectDiscordClient() private readonly client: Client) {}

  async sendWelcomeMessage(member: GuildMember, config: NewbieConfig): Promise<void> {
    if (!config.welcomeChannelId) {
      this.logger.debug(`[WELCOME] welcomeChannelId not set: guild=${member.guild.id}`);
      return;
    }

    const channel = await this.client.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel?.isTextBased()) {
      this.logger.warn(
        `[WELCOME] Channel not found or not text-based: channelId=${config.welcomeChannelId} guild=${member.guild.id}`,
      );
      return;
    }

    const vars: Record<string, string> = {
      username: member.displayName,
      mention: `<@${member.id}>`,
      memberCount: String(member.guild.memberCount),
      serverName: member.guild.name,
    };

    const embed = new EmbedBuilder();

    if (config.welcomeEmbedTitle) {
      embed.setTitle(this.applyTemplate(config.welcomeEmbedTitle, vars));
    }
    if (config.welcomeEmbedDescription) {
      embed.setDescription(this.applyTemplate(config.welcomeEmbedDescription, vars));
    }
    if (config.welcomeEmbedColor) {
      embed.setColor(config.welcomeEmbedColor as `#${string}`);
    }
    if (config.welcomeEmbedThumbnailUrl) {
      embed.setThumbnail(config.welcomeEmbedThumbnailUrl);
    }

    const content = config.welcomeContent
      ? this.applyTemplate(config.welcomeContent, vars)
      : undefined;

    await (channel as TextChannel).send({ content, embeds: [embed] });

    this.logger.log(
      `[WELCOME] Sent welcome message: guild=${member.guild.id} member=${member.id} channel=${config.welcomeChannelId}`,
    );
  }

  /**
   * 템플릿 변수 전역 치환.
   * {변수명} 패턴을 vars 객체의 값으로 치환한다.
   * 동일 변수가 여러 번 등장해도 모두 치환된다.
   */
  private applyTemplate(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
      template,
    );
  }
}
