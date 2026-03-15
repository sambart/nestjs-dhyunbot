import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, EmbedBuilder, Guild } from 'discord.js';

import { DomainException } from '../../common/domain-exception';
import { getErrorStack } from '../../common/util/error.util';
import { InactiveMemberActionType, InactiveMemberGrade } from '../domain/inactive-member.types';
import { InactiveMemberRepository } from '../infrastructure/inactive-member.repository';
import type { InactiveMemberConfigOrm } from '../infrastructure/inactive-member-config.orm-entity';
import { InactiveMemberService } from './inactive-member.service';

export interface ActionResult {
  actionType: InactiveMemberActionType;
  successCount: number;
  failCount: number;
  logId: number;
}

@Injectable()
export class InactiveMemberActionService {
  private readonly logger = new Logger(InactiveMemberActionService.name);

  constructor(
    private readonly repo: InactiveMemberRepository,
    private readonly inactiveMemberService: InactiveMemberService,
    @InjectDiscordClient() private readonly discord: Client,
  ) {}

  async executeAction(
    guildId: string,
    actionType: InactiveMemberActionType,
    targetUserIds: string[],
    executorUserId: string | null = null,
  ): Promise<ActionResult> {
    const config = await this.inactiveMemberService.getOrCreateConfig(guildId);
    const guild = (await this.discord.guilds.fetch(guildId)) as Guild;

    let successCount = 0;
    let failCount = 0;

    if (actionType === InactiveMemberActionType.ACTION_DM) {
      ({ successCount, failCount } = await this.executeDmAction(guild, config, targetUserIds));
    } else if (actionType === InactiveMemberActionType.ACTION_ROLE_ADD) {
      if (!config.inactiveRoleId) {
        throw new DomainException(
          'inactiveRoleId가 설정되지 않아 역할 부여를 실행할 수 없습니다.',
          'INACTIVE_ROLE_NOT_CONFIGURED',
        );
      }
      ({ successCount, failCount } = await this.executeRoleAction(
        guild,
        targetUserIds,
        config.inactiveRoleId,
        'add',
      ));
    } else if (actionType === InactiveMemberActionType.ACTION_ROLE_REMOVE) {
      if (!config.removeRoleId) {
        throw new DomainException(
          'removeRoleId가 설정되지 않아 역할 제거를 실행할 수 없습니다.',
          'REMOVE_ROLE_NOT_CONFIGURED',
        );
      }
      ({ successCount, failCount } = await this.executeRoleAction(
        guild,
        targetUserIds,
        config.removeRoleId,
        'remove',
      ));
    } else if (actionType === InactiveMemberActionType.ACTION_KICK) {
      ({ successCount, failCount } = await this.executeKickAction(guild, targetUserIds));
    }

    const log = await this.repo.saveActionLog({
      guildId,
      actionType,
      targetUserIds,
      executorUserId,
      successCount,
      failCount,
    });

    return { actionType, successCount, failCount, logId: log.id };
  }

  async executeAutoActions(guildId: string, newlyInactiveUserIds: string[]): Promise<void> {
    if (newlyInactiveUserIds.length === 0) return;

    const config = await this.inactiveMemberService.getOrCreateConfig(guildId);

    if (config.autoRoleAdd && config.inactiveRoleId) {
      try {
        await this.executeAction(
          guildId,
          InactiveMemberActionType.ACTION_ROLE_ADD,
          newlyInactiveUserIds,
          null,
        );
      } catch (err) {
        this.logger.error(`[INACTIVE] Auto role add failed guild=${guildId}`, getErrorStack(err));
      }
    }

    if (config.autoDm) {
      try {
        await this.executeAction(
          guildId,
          InactiveMemberActionType.ACTION_DM,
          newlyInactiveUserIds,
          null,
        );
      } catch (err) {
        this.logger.error(`[INACTIVE] Auto DM failed guild=${guildId}`, getErrorStack(err));
      }
    }
  }

  private async executeKickAction(
    guild: Guild,
    targetUserIds: string[],
  ): Promise<{ successCount: number; failCount: number }> {
    let successCount = 0;
    let failCount = 0;

    for (const userId of targetUserIds) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          failCount++;
          continue;
        }

        if (!member.kickable) {
          this.logger.warn(`[INACTIVE] Kick not permitted userId=${userId} (role hierarchy)`);
          failCount++;
          continue;
        }

        await member.kick('비활동 회원 관리 — 강제퇴장');
        successCount++;
      } catch (err) {
        this.logger.warn(`[INACTIVE] Kick failed userId=${userId}`, getErrorStack(err));
        failCount++;
      }
    }

    return { successCount, failCount };
  }

  private async executeDmAction(
    guild: Guild,
    config: InactiveMemberConfigOrm,
    targetUserIds: string[],
  ): Promise<{ successCount: number; failCount: number }> {
    let successCount = 0;
    let failCount = 0;

    for (const userId of targetUserIds) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          failCount++;
          continue;
        }

        const embed = this.buildDmEmbed(config, member.displayName, guild.name);
        await member.send({ embeds: [embed] });
        successCount++;
      } catch (err) {
        this.logger.warn(`[INACTIVE] DM failed userId=${userId}`, getErrorStack(err));
        failCount++;
      }
    }

    return { successCount, failCount };
  }

  private async executeRoleAction(
    guild: Guild,
    targetUserIds: string[],
    roleId: string,
    action: 'add' | 'remove',
  ): Promise<{ successCount: number; failCount: number }> {
    let successCount = 0;
    let failCount = 0;

    for (const userId of targetUserIds) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          failCount++;
          continue;
        }

        if (action === 'add') {
          await member.roles.add(roleId);
        } else {
          await member.roles.remove(roleId);
        }
        successCount++;
      } catch (err) {
        this.logger.warn(`[INACTIVE] Role ${action} failed userId=${userId}`, getErrorStack(err));
        failCount++;
      }
    }

    return { successCount, failCount };
  }

  private buildDmEmbed(
    config: InactiveMemberConfigOrm,
    nickName: string,
    serverName: string,
  ): EmbedBuilder {
    const title = this.replacePlaceholders(config.dmEmbedTitle ?? '', {
      nickName,
      serverName,
    });
    const body = this.replacePlaceholders(config.dmEmbedBody ?? '', {
      nickName,
      serverName,
    });

    const embed = new EmbedBuilder().setTitle(title).setDescription(body);

    if (config.dmEmbedColor) {
      // hex 색상 코드를 숫자로 변환
      const colorHex = config.dmEmbedColor.replace('#', '');
      embed.setColor(parseInt(colorHex, 16));
    }

    return embed;
  }

  private replacePlaceholders(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = vars[key];
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }
}

export { InactiveMemberGrade };
