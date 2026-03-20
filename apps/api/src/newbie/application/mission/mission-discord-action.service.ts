import { Injectable, Logger } from '@nestjs/common';
import type { APIGuildMember } from 'discord.js';
import { DiscordAPIError } from 'discord.js';

import { getErrorMessage } from '../../../common/util/error.util';
import { DiscordRestService } from '../../../discord-rest/discord-rest.service';

/** Discord REST API 액션 (역할 부여/강퇴/DM/멤버 조회) 전담. */
@Injectable()
export class MissionDiscordActionService {
  private readonly logger = new Logger(MissionDiscordActionService.name);

  constructor(private readonly discordRest: DiscordRestService) {}

  /**
   * 멤버에게 역할을 부여한다.
   * @returns warning 메시지 (실패 시) 또는 undefined
   */
  async grantRole(guildId: string, memberId: string, roleId: string): Promise<string | undefined> {
    try {
      await this.discordRest.addMemberRole(guildId, memberId, roleId);
      this.logger.log(`[MISSION] Role granted: member=${memberId} role=${roleId}`);
      return undefined;
    } catch (err) {
      const warning = `역할 부여에 실패했습니다: ${getErrorMessage(err)}`;
      this.logger.warn(`[MISSION] Role grant failed: ${warning}`);
      return warning;
    }
  }

  /**
   * DM 사유 전송 후 멤버를 강퇴한다.
   * @returns warning 메시지 (실패 시) 또는 undefined
   */
  async sendDmAndKick(
    guildId: string,
    memberId: string,
    dmReason?: string | null,
  ): Promise<string | undefined> {
    try {
      if (dmReason) {
        await this.discordRest.sendDM(memberId, dmReason).catch(() => {
          this.logger.warn(`[MISSION] DM failed (blocked or unavailable): member=${memberId}`);
        });
      }

      await this.discordRest.kickMember(guildId, memberId, '미션 실패 처리');
      this.logger.log(`[MISSION] Kicked: member=${memberId}`);
      return undefined;
    } catch (err) {
      const warning = `강퇴에 실패했습니다: ${getErrorMessage(err)}`;
      this.logger.warn(`[MISSION] Kick failed: ${warning}`);
      return warning;
    }
  }

  /**
   * 길드 전체 멤버를 조회한다.
   * @returns APIGuildMember 배열 또는 null
   */
  async fetchGuildMembers(guildId: string): Promise<APIGuildMember[] | null> {
    try {
      return await this.discordRest.fetchAllGuildMembers(guildId);
    } catch {
      return null;
    }
  }

  /**
   * 개별 멤버의 존재 여부를 확인한다.
   * @returns { member, isConfirmedAbsent } -- member가 null이고 isConfirmedAbsent가 false이면 판단 불가(일시 오류)
   */
  async checkMemberExists(
    guildId: string,
    memberId: string,
  ): Promise<{ member: APIGuildMember | null; isConfirmedAbsent: boolean }> {
    try {
      const member = await this.discordRest.fetchGuildMember(guildId, memberId);
      if (member) {
        return { member, isConfirmedAbsent: false };
      }
      // fetchGuildMember returns null on 404
      return { member: null, isConfirmedAbsent: true };
    } catch (err) {
      if (err instanceof DiscordAPIError && err.code === 10007) {
        return { member: null, isConfirmedAbsent: true };
      }
      this.logger.warn(
        `[MISSION] Member fetch failed: member=${memberId} error=${getErrorMessage(err)}`,
      );
      return { member: null, isConfirmedAbsent: false };
    }
  }

  /**
   * 멤버의 displayName을 조회한다.
   */
  async fetchMemberDisplayName(guildId: string, memberId: string): Promise<string | null> {
    try {
      const member = await this.discordRest.fetchGuildMember(guildId, memberId);
      return member ? this.discordRest.getMemberDisplayName(member) : null;
    } catch {
      return null;
    }
  }
}
