import { getKSTDateString } from '@dhyunbot/shared';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, GuildMember } from 'discord.js';

import { NewbieConfig } from '../domain/newbie-config.entity';
import { NewbiePeriodRepository } from '../infrastructure/newbie-period.repository';
import { NewbieRedisRepository } from '../infrastructure/newbie-redis.repository';

@Injectable()
export class NewbieRoleService {
  private readonly logger = new Logger(NewbieRoleService.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly periodRepository: NewbiePeriodRepository,
    private readonly redisRepository: NewbieRedisRepository,
  ) {}

  /**
   * guildMemberAdd 이벤트 수신 시 NewbieGateway에서 호출된다.
   * config는 Gateway에서 이미 조회하여 전달한다.
   * roleEnabled 조건은 Gateway에서 사전 확인됨.
   */
  async assignRole(member: GuildMember, config: NewbieConfig): Promise<void> {
    if (!config.newbieRoleId) {
      this.logger.debug(
        `[NEWBIE ROLE] newbieRoleId not set: guild=${member.guild.id}`,
      );
      return;
    }

    const guildId = member.guild.id;
    const memberId = member.id;
    const roleId = config.newbieRoleId;

    // 1. Discord API — 역할 부여
    await member.roles.add(roleId);
    this.logger.log(
      `[NEWBIE ROLE] Assigned role ${roleId} to ${memberId} in guild ${guildId}`,
    );

    // 2. NewbiePeriod 레코드 생성
    const startDate = getKSTDateString();
    const expiresDate = this.calcExpiresDate(startDate, config.roleDurationDays!);

    await this.periodRepository.create(guildId, memberId, startDate, expiresDate);

    // 3. Redis 신입기간 활성 멤버 Set 갱신 (SADD)
    //    캐시가 없는 경우 SADD는 새 Set을 만들지 않는다.
    //    캐시가 있는 경우에만 memberId를 추가해 정합성을 유지한다.
    await this.redisRepository.addPeriodActiveMember(guildId, memberId);

    this.logger.log(
      `[NEWBIE ROLE] NewbiePeriod created: guild=${guildId} member=${memberId} ` +
        `startDate=${startDate} expiresDate=${expiresDate}`,
    );
  }

  /** startDate(YYYYMMDD) + days 일수를 더한 expiresDate(YYYYMMDD) 계산 */
  private calcExpiresDate(startDate: string, days: number): string {
    const year = parseInt(startDate.slice(0, 4), 10);
    const month = parseInt(startDate.slice(4, 6), 10) - 1; // 0-indexed
    const day = parseInt(startDate.slice(6, 8), 10);

    const date = new Date(year, month, day);
    date.setDate(date.getDate() + days);

    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}${m}${d}`;
  }
}
