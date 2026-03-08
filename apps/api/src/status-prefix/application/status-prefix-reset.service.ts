import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, Client, GuildMember } from 'discord.js';

import { StatusPrefixConfigRepository } from '../infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from '../infrastructure/status-prefix-redis.repository';

@Injectable()
export class StatusPrefixResetService {
  private readonly logger = new Logger(StatusPrefixResetService.name);

  constructor(
    private readonly configRepo: StatusPrefixConfigRepository,
    private readonly redis: StatusPrefixRedisRepository,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {}

  /**
   * F-STATUS-PREFIX-004: 버튼 클릭으로 원래 닉네임 복원.
   *
   * 처리 흐름:
   * 1. Redis에서 원래 닉네임 조회
   * 2. 없으면 Ephemeral 안내 메시지 응답 후 종료
   * 3. 있으면 GuildMember.setNickname(originalNickname) 호출
   * 4. Redis 키 삭제
   * 5. Ephemeral 성공 응답
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 클릭한 멤버 ID
   * @param interaction - ButtonInteraction 인스턴스 (응답 및 멤버 정보 추출용)
   */
  async reset(
    guildId: string,
    memberId: string,
    interaction: ButtonInteraction,
  ): Promise<void> {
    // 1. Redis에서 원래 닉네임 조회
    const originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    // 2. 없으면 변경 이력 없음 안내
    if (!originalNickname) {
      await interaction.reply({
        ephemeral: true,
        content: '변경된 닉네임이 없습니다.',
      });
      return;
    }

    const member = interaction.member as GuildMember;

    // 3. Discord API 닉네임 복원
    try {
      await member.setNickname(originalNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] reset setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      await interaction.reply({
        ephemeral: true,
        content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
      });
      return;
    }

    // 4. Redis 키 삭제
    await this.redis.deleteOriginalNickname(guildId, memberId);

    // 5. Ephemeral 성공 응답
    await interaction.reply({
      ephemeral: true,
      content: '닉네임이 원래대로 복원되었습니다.',
    });

    this.logger.log(
      `[STATUS_PREFIX] Reset: guild=${guildId} member=${memberId} restored="${originalNickname}"`,
    );
  }

  /**
   * F-STATUS-PREFIX-005: 음성 채널 퇴장 시 닉네임 자동 복원.
   * VoiceLeaveHandler에서 fire-and-forget으로 호출된다.
   * 오류 시 로그 기록 후 조용히 실패한다.
   *
   * 처리 흐름:
   * 1. Redis 설정 캐시에서 enabled 확인 (캐시 미스 시 DB 조회)
   * 2. enabled = false 이면 즉시 반환
   * 3. Redis에서 원래 닉네임 조회
   * 4. 없으면 처리 중단 (닉네임 변경 이력 없음)
   * 5. Discord Client로 GuildMember fetch
   * 6. setNickname(originalNickname) 호출
   * 7. Redis 키 삭제
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 퇴장한 멤버 ID
   */
  async restoreOnLeave(guildId: string, memberId: string): Promise<void> {
    // 1. 설정 enabled 확인 (Redis 캐시 우선, 미스 시 DB)
    let enabled = false;

    const cachedConfig = await this.redis.getConfig(guildId);

    if (cachedConfig !== null) {
      enabled = cachedConfig.enabled;
    } else {
      const dbConfig = await this.configRepo.findByGuildId(guildId);
      enabled = dbConfig?.enabled ?? false;
    }

    // 2. enabled = false 이면 중단
    if (!enabled) return;

    // 3. Redis에서 원래 닉네임 조회
    const originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    // 4. 없으면 처리 중단
    if (!originalNickname) return;

    // 5. Discord GuildMember fetch (인터랙션 컨텍스트 없이 Client 직접 사용)
    let member: GuildMember;
    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      member = await guild.members.fetch(memberId);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] restoreOnLeave: Failed to fetch member guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      // 멤버 fetch 실패 시 Redis 키는 유지 (비정상 종료 대비)
      return;
    }

    // 6. 닉네임 복원
    try {
      await member.setNickname(originalNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] restoreOnLeave setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      // setNickname 실패 시도 Redis 키 삭제 (봇 권한 없으면 계속 실패하므로 키 누적 방지)
    }

    // 7. Redis 키 삭제 (setNickname 성공/실패 무관하게 삭제)
    await this.redis.deleteOriginalNickname(guildId, memberId);

    this.logger.log(
      `[STATUS_PREFIX] restoreOnLeave: guild=${guildId} member=${memberId} restored="${originalNickname}"`,
    );
  }
}
