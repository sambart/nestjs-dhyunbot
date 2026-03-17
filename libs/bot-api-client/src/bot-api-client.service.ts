import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import type {
  AutoChannelButtonClickDto,
  AutoChannelButtonResult,
  AutoChannelSubOptionDto,
  BotApiResponse,
  KickMemberDto,
  MemberDisplayNameResponse,
  MemberJoinDto,
  MessageCreatedDto,
  MissionRefreshDto,
  NewbieConfigDto,
  RoleAssignedDto,
  RoleModifyDto,
  StatusPrefixApplyDto,
  StatusPrefixApplyResult,
  StatusPrefixResetDto,
  StatusPrefixResetResult,
  VoiceStateUpdateDto,
} from './types';

/**
 * Bot → API HTTP 클라이언트.
 * API_BASE_URL과 BOT_API_KEY를 환경 변수에서 읽어 자동으로 인증 헤더를 추가한다.
 */
@Injectable()
export class BotApiClientService {
  private readonly logger = new Logger(BotApiClientService.name);

  constructor(private readonly http: HttpService) {}

  // ── Voice ──

  async sendVoiceStateUpdate(dto: VoiceStateUpdateDto): Promise<void> {
    await this.post('/bot-api/voice/state-update', dto);
  }

  async voiceFlush(): Promise<{ flushed: number; skipped: number }> {
    return this.post('/bot-api/voice/flush', {});
  }

  // ── Newbie ──

  async sendMemberJoin(dto: MemberJoinDto): Promise<void> {
    await this.post('/bot-api/newbie/member-join', dto);
  }

  async refreshMissionEmbed(dto: MissionRefreshDto): Promise<void> {
    await this.post('/bot-api/newbie/mission-refresh', dto);
  }

  async getMocoRankData(guildId: string, page: number): Promise<BotApiResponse> {
    return this.get(`/bot-api/newbie/moco-rank?guildId=${guildId}&page=${page}`);
  }

  async getMyHuntingData(guildId: string, userId: string): Promise<BotApiResponse<string>> {
    return this.get(`/bot-api/newbie/moco-my?guildId=${guildId}&userId=${userId}`);
  }

  async getNewbieConfig(guildId: string): Promise<NewbieConfigDto | null> {
    try {
      const response = await this.get<BotApiResponse<NewbieConfigDto>>(
        `/bot-api/newbie/config?guildId=${guildId}`,
      );
      return response.data ?? null;
    } catch {
      return null;
    }
  }

  async notifyRoleAssigned(dto: RoleAssignedDto): Promise<void> {
    await this.post('/bot-api/newbie/role-assigned', dto);
  }

  // ── Status Prefix ──

  async applyStatusPrefix(dto: StatusPrefixApplyDto): Promise<StatusPrefixApplyResult> {
    return this.post('/bot-api/status-prefix/apply', dto);
  }

  async resetStatusPrefix(dto: StatusPrefixResetDto): Promise<StatusPrefixResetResult> {
    return this.post('/bot-api/status-prefix/reset', dto);
  }

  // ── Auto Channel ──

  async autoChannelButtonClick(dto: AutoChannelButtonClickDto): Promise<AutoChannelButtonResult> {
    return this.post('/bot-api/auto-channel/button-click', dto);
  }

  async autoChannelSubOption(dto: AutoChannelSubOptionDto): Promise<AutoChannelButtonResult> {
    return this.post('/bot-api/auto-channel/sub-option', dto);
  }

  // ── Sticky Message ──

  async sendMessageCreated(dto: MessageCreatedDto): Promise<void> {
    await this.post('/bot-api/sticky-message/message-created', dto);
  }

  // ── Guild ──

  async getMemberDisplayName(
    guildId: string,
    memberId: string,
  ): Promise<MemberDisplayNameResponse> {
    return this.get(`/bot-api/guilds/${guildId}/members/${memberId}/display-name`);
  }

  async addRole(dto: RoleModifyDto): Promise<BotApiResponse> {
    return this.post(`/bot-api/guilds/${dto.guildId}/members/${dto.memberId}/roles/add`, {
      roleId: dto.roleId,
    });
  }

  async removeRole(dto: RoleModifyDto): Promise<BotApiResponse> {
    return this.post(`/bot-api/guilds/${dto.guildId}/members/${dto.memberId}/roles/remove`, {
      roleId: dto.roleId,
    });
  }

  async kickMember(dto: KickMemberDto): Promise<BotApiResponse> {
    return this.post(`/bot-api/guilds/${dto.guildId}/members/${dto.memberId}/kick`, {
      reason: dto.reason,
    });
  }

  // ── Internal ──

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await firstValueFrom(this.http.post<T>(path, body));
      return response.data;
    } catch (err) {
      this.logger.error(`[BOT-API] POST ${path} failed`, err);
      throw err;
    }
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const response = await firstValueFrom(this.http.get<T>(path));
      return response.data;
    } catch (err) {
      this.logger.error(`[BOT-API] GET ${path} failed`, err);
      throw err;
    }
  }
}
