import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'discord.js';

import { getErrorStack } from '../../../common/util/error.util';

/** Discord API를 통한 역할 부여/제거 전담. */
@Injectable()
export class NewbieRoleDiscordAdapter {
  private readonly logger = new Logger(NewbieRoleDiscordAdapter.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
  ) {}

  /**
   * 멤버에게 역할을 제거한다.
   * 실패 시에도 예외를 던지지 않는다 (멤버 부재, 역할 부재 등 정상 상황 포함).
   */
  async tryRemoveRole(guildId: string, memberId: string, roleId: string): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) throw new Error(`Guild ${guildId} not found in cache`);
      const member = await guild.members.fetch(memberId);
      await member.roles.remove(roleId);
      this.logger.log(`[NEWBIE ROLE] Role removed: guild=${guildId} member=${memberId}`);
    } catch (error) {
      this.logger.warn(
        `[NEWBIE ROLE] Failed to remove role (will still mark expired): ` +
          `guild=${guildId} member=${memberId}`,
        getErrorStack(error),
      );
    }
  }
}
