import { InjectDiscordClient, On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { BotApiClientService } from '@onyu/bot-api-client';
import { Client, EmbedBuilder, type GuildMember } from 'discord.js';

/**
 * Discord guildMemberAdd 이벤트를 수신하여 신입 온보딩을 처리한다.
 * - 환영인사: Bot에서 직접 Discord 메시지 전송 (GuildMember 필요)
 * - 미션 생성: API에 위임
 * - 역할 부여: Bot에서 직접 Discord API 호출 후 API에 통보
 */
@Injectable()
export class BotNewbieMemberAddHandler {
  private readonly logger = new Logger(BotNewbieMemberAddHandler.name);

  constructor(
    private readonly apiClient: BotApiClientService,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  @On('guildMemberAdd')
  async handleGuildMemberAdd(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    try {
      // 1. API에서 설정 조회
      const config = await this.apiClient.getNewbieConfig(guildId);
      if (!config) return;

      // 2. 환영인사 (Bot에서 직접 Discord 메시지 전송)
      if (config.welcomeEnabled && config.welcomeChannelId) {
        await this.sendWelcomeMessage(member, config.welcomeChannelId, config.welcomeMessage);
      }

      // 3. 미션 생성 (API 호출)
      if (config.missionEnabled) {
        await this.apiClient.sendMemberJoin({
          guildId,
          memberId: member.id,
          displayName: member.displayName,
        });
      }

      // 4. 역할 부여 (Bot에서 직접 Discord API 호출)
      if (config.roleEnabled && config.newbieRoleId) {
        await this.assignRole(member, config.newbieRoleId, guildId);
      }
    } catch (err) {
      this.logger.error(
        `[BOT] guildMemberAdd failed: guild=${guildId} member=${member.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  private async sendWelcomeMessage(
    member: GuildMember,
    channelId: string,
    messageTemplate: string | null,
  ): Promise<void> {
    try {
      const channel = await this.discord.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const content =
        messageTemplate
          ?.replace('{username}', member.displayName)
          .replace('{mention}', `<@${member.id}>`)
          .replace('{serverName}', member.guild.name) ?? `${member.displayName}님, 환영합니다!`;

      const embed = new EmbedBuilder()
        .setDescription(content)
        .setColor(0x57f287)
        .setThumbnail(member.displayAvatarURL({ size: 128 }));

      await channel.send({ embeds: [embed] });
    } catch (err) {
      this.logger.error(
        `[BOT] Welcome message failed: guild=${member.guild.id} member=${member.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }

  private async assignRole(
    member: GuildMember,
    roleId: string,
    guildId: string,
  ): Promise<void> {
    try {
      await member.roles.add(roleId);
      this.logger.log(
        `[BOT] Role assigned: guild=${guildId} member=${member.id} role=${roleId}`,
      );

      // API에 역할 부여 사실 통보 (NewbiePeriod 레코드 생성)
      await this.apiClient.notifyRoleAssigned({ guildId, memberId: member.id });
    } catch (err) {
      this.logger.error(
        `[BOT] Role assign failed: guild=${guildId} member=${member.id} role=${roleId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
