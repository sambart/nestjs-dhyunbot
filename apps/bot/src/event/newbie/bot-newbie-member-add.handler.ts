import { BotApiClientService } from '@dhyunbot/bot-api-client';
import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import type { GuildMember } from 'discord.js';

/**
 * Discord guildMemberAdd 이벤트를 수신하여 API로 전달한다.
 * 신규 멤버 가입 시 API에서 뉴비 플로우를 처리한다.
 */
@Injectable()
export class BotNewbieMemberAddHandler {
  private readonly logger = new Logger(BotNewbieMemberAddHandler.name);

  constructor(private readonly apiClient: BotApiClientService) {}

  @On('guildMemberAdd')
  async handleGuildMemberAdd(member: GuildMember): Promise<void> {
    try {
      await this.apiClient.sendMemberJoin({
        guildId: member.guild.id,
        memberId: member.id,
        displayName: member.displayName,
      });
    } catch (err) {
      // fire-and-forget: API 호출 실패 시 로그만 남김
      this.logger.error(
        `[BOT] guildMemberAdd forwarding failed: guild=${member.guild.id} member=${member.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
