import { DiscordAPIError } from 'discord.js';
import { type Mock } from 'vitest';

import { MissionDiscordActionService } from './mission-discord-action.service';

describe('MissionDiscordActionService', () => {
  let service: MissionDiscordActionService;
  let discordRest: {
    addMemberRole: Mock;
    sendDM: Mock;
    kickMember: Mock;
    fetchAllGuildMembers: Mock;
    fetchGuildMember: Mock;
    getMemberDisplayName: Mock;
  };

  beforeEach(() => {
    discordRest = {
      addMemberRole: vi.fn(),
      sendDM: vi.fn(),
      kickMember: vi.fn(),
      fetchAllGuildMembers: vi.fn(),
      fetchGuildMember: vi.fn(),
      getMemberDisplayName: vi.fn(),
    };

    service = new MissionDiscordActionService(discordRest as never);
  });

  // ──────────────────────────────────────────────────────
  // grantRole
  // ──────────────────────────────────────────────────────
  describe('grantRole', () => {
    it('역할 부여 성공 시 undefined 반환', async () => {
      discordRest.addMemberRole.mockResolvedValue(undefined);

      const result = await service.grantRole('guild-1', 'user-1', 'role-1');

      expect(result).toBeUndefined();
      expect(discordRest.addMemberRole).toHaveBeenCalledWith('guild-1', 'user-1', 'role-1');
    });

    it('역할 부여 실패 시 warning 문자열 반환 (throw 없음)', async () => {
      discordRest.addMemberRole.mockRejectedValue(new Error('권한 없음'));

      const result = await service.grantRole('guild-1', 'user-1', 'role-1');

      expect(typeof result).toBe('string');
      expect(result).toContain('역할 부여에 실패했습니다');
    });
  });

  // ──────────────────────────────────────────────────────
  // sendDmAndKick
  // ──────────────────────────────────────────────────────
  describe('sendDmAndKick', () => {
    it('DM 전송 후 강퇴 성공 시 undefined 반환', async () => {
      discordRest.sendDM.mockResolvedValue(undefined);
      discordRest.kickMember.mockResolvedValue(undefined);

      const result = await service.sendDmAndKick('guild-1', 'user-1', '강퇴 사유');

      expect(discordRest.sendDM).toHaveBeenCalledWith('user-1', '강퇴 사유');
      expect(discordRest.kickMember).toHaveBeenCalledWith('guild-1', 'user-1', '미션 실패 처리');
      expect(result).toBeUndefined();
    });

    it('DM 실패해도 강퇴는 계속 진행된다', async () => {
      discordRest.sendDM.mockRejectedValue(new Error('DM 차단됨'));
      discordRest.kickMember.mockResolvedValue(undefined);

      const result = await service.sendDmAndKick('guild-1', 'user-1', '강퇴 사유');

      expect(discordRest.kickMember).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('dmReason이 null이면 DM 전송하지 않는다', async () => {
      discordRest.kickMember.mockResolvedValue(undefined);

      await service.sendDmAndKick('guild-1', 'user-1', null);

      expect(discordRest.sendDM).not.toHaveBeenCalled();
      expect(discordRest.kickMember).toHaveBeenCalled();
    });

    it('dmReason이 undefined이면 DM 전송하지 않는다', async () => {
      discordRest.kickMember.mockResolvedValue(undefined);

      await service.sendDmAndKick('guild-1', 'user-1');

      expect(discordRest.sendDM).not.toHaveBeenCalled();
    });

    it('강퇴 실패 시 warning 문자열 반환 (throw 없음)', async () => {
      discordRest.sendDM.mockResolvedValue(undefined);
      discordRest.kickMember.mockRejectedValue(new Error('강퇴 권한 없음'));

      const result = await service.sendDmAndKick('guild-1', 'user-1', '사유');

      expect(typeof result).toBe('string');
      expect(result).toContain('강퇴에 실패했습니다');
    });
  });

  // ──────────────────────────────────────────────────────
  // checkMemberExists
  // ──────────────────────────────────────────────────────
  describe('checkMemberExists', () => {
    it('멤버 조회 성공 시 { member, isConfirmedAbsent: false } 반환', async () => {
      const memberData = { user: { id: 'user-1', bot: false } };
      discordRest.fetchGuildMember.mockResolvedValue(memberData);

      const result = await service.checkMemberExists('guild-1', 'user-1');

      expect(result.member).toBe(memberData);
      expect(result.isConfirmedAbsent).toBe(false);
    });

    it('fetchGuildMember가 null 반환 시 isConfirmedAbsent=true', async () => {
      discordRest.fetchGuildMember.mockResolvedValue(null);

      const result = await service.checkMemberExists('guild-1', 'user-1');

      expect(result.member).toBeNull();
      expect(result.isConfirmedAbsent).toBe(true);
    });

    it('DiscordAPIError code=10007 시 isConfirmedAbsent=true (확실히 나간 멤버)', async () => {
      const error = new DiscordAPIError(
        { code: 10007, message: 'Unknown Member' },
        10007,
        404,
        'GET',
        '',
        {},
      );
      discordRest.fetchGuildMember.mockRejectedValue(error);

      const result = await service.checkMemberExists('guild-1', 'user-1');

      expect(result.member).toBeNull();
      expect(result.isConfirmedAbsent).toBe(true);
    });

    it('일시 오류(비 DiscordAPIError)는 판단 불가 → { member: null, isConfirmedAbsent: false }', async () => {
      discordRest.fetchGuildMember.mockRejectedValue(new Error('서버 오류'));

      const result = await service.checkMemberExists('guild-1', 'user-1');

      expect(result.member).toBeNull();
      expect(result.isConfirmedAbsent).toBe(false);
    });

    it('DiscordAPIError이지만 10007이 아닌 코드는 판단 불가', async () => {
      const error = new DiscordAPIError(
        { code: 50013, message: 'Missing Permissions' },
        50013,
        403,
        'GET',
        '',
        {},
      );
      discordRest.fetchGuildMember.mockRejectedValue(error);

      const result = await service.checkMemberExists('guild-1', 'user-1');

      expect(result.member).toBeNull();
      expect(result.isConfirmedAbsent).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────
  // fetchMemberDisplayName
  // ──────────────────────────────────────────────────────
  describe('fetchMemberDisplayName', () => {
    it('멤버 조회 성공 시 displayName 반환', async () => {
      const memberData = { user: { id: 'user-1' }, nick: '동현' };
      discordRest.fetchGuildMember.mockResolvedValue(memberData);
      discordRest.getMemberDisplayName.mockReturnValue('동현');

      const result = await service.fetchMemberDisplayName('guild-1', 'user-1');

      expect(result).toBe('동현');
      expect(discordRest.getMemberDisplayName).toHaveBeenCalledWith(memberData);
    });

    it('멤버가 없으면(null) null 반환', async () => {
      discordRest.fetchGuildMember.mockResolvedValue(null);

      const result = await service.fetchMemberDisplayName('guild-1', 'user-1');

      expect(result).toBeNull();
    });

    it('fetchGuildMember 실패 시 null 반환 (throw 없음)', async () => {
      discordRest.fetchGuildMember.mockRejectedValue(new Error('API 오류'));

      const result = await service.fetchMemberDisplayName('guild-1', 'user-1');

      expect(result).toBeNull();
    });

    it('nick → global_name → username 폴백은 getMemberDisplayName에 위임된다', async () => {
      // getMemberDisplayName 구현에서 폴백을 처리하므로,
      // 여기서는 해당 메서드가 호출됨을 검증
      const memberData = {
        user: { id: 'user-1', global_name: 'global', username: 'user' },
        nick: null,
      };
      discordRest.fetchGuildMember.mockResolvedValue(memberData);
      discordRest.getMemberDisplayName.mockReturnValue('global');

      const result = await service.fetchMemberDisplayName('guild-1', 'user-1');

      expect(discordRest.getMemberDisplayName).toHaveBeenCalledWith(memberData);
      expect(result).toBe('global');
    });
  });
});
