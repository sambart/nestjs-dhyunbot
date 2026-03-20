import { Injectable, Logger } from '@nestjs/common';

import { getErrorStack } from '../../../common/util/error.util';
import { DiscordRestService } from '../../../discord-rest/discord-rest.service';

/** Discord REST API를 통한 역할 부여/제거 전담. */
@Injectable()
export class NewbieRoleDiscordAdapter {
  private readonly logger = new Logger(NewbieRoleDiscordAdapter.name);

  constructor(private readonly discordRest: DiscordRestService) {}

  /**
   * 멤버에게 역할을 제거한다.
   * 실패 시에도 예외를 던지지 않는다 (멤버 부재, 역할 부재 등 정상 상황 포함).
   */
  async tryRemoveRole(guildId: string, memberId: string, roleId: string): Promise<void> {
    try {
      await this.discordRest.removeMemberRole(guildId, memberId, roleId);
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
