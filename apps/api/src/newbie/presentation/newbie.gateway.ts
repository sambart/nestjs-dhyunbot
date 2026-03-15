import { On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { GuildMember } from 'discord.js';

import { getErrorStack } from '../../common/util/error.util';
import { MissionService } from '../application/mission/mission.service';
import { NewbieRoleService } from '../application/role/newbie-role.service';
import { WelcomeService } from '../application/welcome/welcome.service';
import { NewbieConfigRepository } from '../infrastructure/newbie-config.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

@Injectable()
export class NewbieGateway {
  private readonly logger = new Logger(NewbieGateway.name);

  constructor(
    private readonly configRepo: NewbieConfigRepository,
    private readonly redisRepo: NewbieRedisRepository,
    private readonly welcomeService: WelcomeService,
    private readonly missionService: MissionService,
    private readonly roleService: NewbieRoleService,
  ) {}

  @On('guildMemberAdd')
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      const guildId = member.guild.id;

      // 1. 설정 조회 (Redis 캐시 우선)
      let config = await this.redisRepo.getConfig(guildId);
      if (!config) {
        config = await this.configRepo.findByGuildId(guildId);
        if (config) {
          await this.redisRepo.setConfig(guildId, config);
        }
      }

      if (!config) return;

      // 2. 환영인사
      if (config.welcomeEnabled) {
        try {
          await this.welcomeService.sendWelcomeMessage(member, config);
        } catch (err) {
          this.logger.error(`[welcome] guild=${guildId} member=${member.id}`, getErrorStack(err));
        }
      }

      // 3. 미션 생성
      if (config.missionEnabled) {
        try {
          await this.missionService.createMission(member, config);
        } catch (err) {
          this.logger.error(`[mission] guild=${guildId} member=${member.id}`, getErrorStack(err));
        }
      }

      // 4. 신입기간 역할 부여
      if (config.roleEnabled) {
        try {
          await this.roleService.assignRole(member, config);
        } catch (err) {
          this.logger.error(`[role] guild=${guildId} member=${member.id}`, getErrorStack(err));
        }
      }
    } catch (err) {
      this.logger.error(
        `[guildMemberAdd] unhandled error: guild=${member.guild.id} member=${member.id}`,
        getErrorStack(err),
      );
    }
  }
}
