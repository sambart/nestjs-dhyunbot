/**
 * BotUserPrivacyController 단위 테스트
 * 대상: POST /bot-api/user-privacy/upsert
 *
 * BotApiAuthGuard는 직접 메서드 호출로 우회한다.
 * UserPrivacyConfigService는 vi.fn()으로 대체한다.
 */

import type { Mock } from 'vitest';

import type { UserPrivacyConfigService } from '../../user-privacy/application/user-privacy-config.service';
import { BotUserPrivacyController } from './bot-user-privacy.controller';

function makePrivacyService(): jest.Mocked<UserPrivacyConfigService> {
  return {
    upsert: vi.fn().mockResolvedValue(undefined),
    isPrivate: vi.fn(),
    filterPeers: vi.fn(),
    getOne: vi.fn(),
  } as unknown as jest.Mocked<UserPrivacyConfigService>;
}

describe('BotUserPrivacyController', () => {
  let controller: BotUserPrivacyController;
  let privacyService: ReturnType<typeof makePrivacyService>;

  beforeEach(() => {
    privacyService = makePrivacyService();
    controller = new BotUserPrivacyController(
      privacyService as unknown as UserPrivacyConfigService,
    );
    vi.clearAllMocks();
  });

  describe('upsert', () => {
    it('정상 요청 시 { ok: true } 반환', async () => {
      (privacyService.upsert as Mock).mockResolvedValue(undefined);

      const result = await controller.upsert({
        guildId: 'guild-1',
        userId: 'user-1',
        disableRelationshipShare: true,
      });

      expect(result).toEqual({ ok: true });
    });

    it('service.upsert에 올바른 인자가 전달된다', async () => {
      (privacyService.upsert as Mock).mockResolvedValue(undefined);

      await controller.upsert({
        guildId: 'guild-1',
        userId: 'user-2',
        disableRelationshipShare: false,
      });

      expect(privacyService.upsert).toHaveBeenCalledWith('guild-1', 'user-2', false);
    });

    it('disableRelationshipShare=true → service.upsert(true) 전달', async () => {
      (privacyService.upsert as Mock).mockResolvedValue(undefined);

      await controller.upsert({
        guildId: 'guild-x',
        userId: 'user-x',
        disableRelationshipShare: true,
      });

      expect(privacyService.upsert).toHaveBeenCalledWith('guild-x', 'user-x', true);
    });
  });
});
