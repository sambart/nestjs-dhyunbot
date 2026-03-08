import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, GuildMember } from 'discord.js';

import { StatusPrefixConfigRepository } from '../infrastructure/status-prefix-config.repository';
import { StatusPrefixRedisRepository } from '../infrastructure/status-prefix-redis.repository';
import { StatusPrefixConfigService } from './status-prefix-config.service';

@Injectable()
export class StatusPrefixApplyService {
  private readonly logger = new Logger(StatusPrefixApplyService.name);

  constructor(
    private readonly configRepo: StatusPrefixConfigRepository,
    private readonly redis: StatusPrefixRedisRepository,
    private readonly configService: StatusPrefixConfigService,
  ) {}

  /**
   * F-STATUS-PREFIX-003: 접두사 적용.
   *
   * 처리 흐름:
   * 1. buttonId로 StatusPrefixButton 조회
   * 2. guildId로 StatusPrefixConfig 조회 (Redis 캐시 우선) — prefixTemplate 획득
   * 3. Redis에서 원래 닉네임 조회
   *    - 없으면: 현재 Discord displayName을 원래 닉네임으로 NX 저장
   *    - 있으면: 기존 값 유지 (덮어쓰기 방지)
   * 4. prefixTemplate 적용 → 새 닉네임 생성
   * 5. GuildMember.setNickname()으로 닉네임 변경
   * 6. Ephemeral 성공 응답
   *
   * @param guildId - Discord 서버 ID
   * @param memberId - 클릭한 멤버 ID
   * @param buttonId - 클릭된 버튼 DB ID (customId에서 파싱)
   * @param interaction - ButtonInteraction 인스턴스 (응답 및 멤버 정보 추출용)
   */
  async apply(
    guildId: string,
    memberId: string,
    buttonId: number,
    interaction: ButtonInteraction,
  ): Promise<void> {
    // 1. 버튼 조회
    const button = await this.configRepo.findButtonById(buttonId);

    if (!button) {
      await interaction.reply({
        ephemeral: true,
        content: '버튼 설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    if (!button.prefix) {
      // PREFIX 타입이지만 prefix 값이 없는 비정상 상태
      await interaction.reply({
        ephemeral: true,
        content: '접두사 설정이 올바르지 않습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    // 2. 설정 조회 (Redis 캐시 우선) — prefixTemplate 획득
    const config = await this.configService.getConfig(guildId);

    if (!config) {
      await interaction.reply({
        ephemeral: true,
        content: '서버 설정을 찾을 수 없습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const currentDisplayName = member.displayName;

    // 3. 원래 닉네임 조회 또는 최초 저장 (NX — 이미 값이 있으면 덮어쓰지 않음)
    let originalNickname = await this.redis.getOriginalNickname(guildId, memberId);

    if (!originalNickname) {
      // 최초 접두사 적용 → 현재 displayName을 원래 닉네임으로 NX 저장
      await this.redis.setOriginalNicknameNx(guildId, memberId, currentDisplayName);
      originalNickname = currentDisplayName;
    }
    // originalNickname이 이미 있으면 기존 값 유지 (덮어쓰기 방지)

    // 4. 템플릿 적용 → 새 닉네임 생성
    // 예: '[{prefix}] {nickname}' + prefix='관전', nickname='동현' → '[관전] 동현'
    const newNickname = config.prefixTemplate
      .replace('{prefix}', button.prefix)
      .replace('{nickname}', originalNickname);

    // 5. Discord API 닉네임 변경
    try {
      await member.setNickname(newNickname);
    } catch (err) {
      this.logger.warn(
        `[STATUS_PREFIX] setNickname failed: guild=${guildId} member=${memberId}`,
        (err as Error).stack,
      );
      await interaction.reply({
        ephemeral: true,
        content: '닉네임을 변경할 권한이 없습니다. 봇 역할을 확인해 주세요.',
      });
      return;
    }

    // 6. Ephemeral 성공 응답
    await interaction.reply({
      ephemeral: true,
      content: `닉네임이 **${newNickname}** 으로 변경되었습니다.`,
    });

    this.logger.log(
      `[STATUS_PREFIX] Apply: guild=${guildId} member=${memberId} nickname="${newNickname}"`,
    );
  }
}
