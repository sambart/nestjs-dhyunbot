import type { DeleteResult, Repository } from 'typeorm';
import type { Mocked } from 'vitest';

import type { VoiceCoPresencePairDailyOrm } from '../co-presence/infrastructure/voice-co-presence-pair-daily.orm-entity';
import type { VoiceChannelHistoryOrm } from '../infrastructure/voice-channel-history.orm-entity';
import type { VoiceDailyOrm } from '../infrastructure/voice-daily.orm-entity';
import { DataDeletionService } from './data-deletion.service';

function makeDeleteQb(affected: number) {
  return {
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected } as DeleteResult),
  };
}

describe('DataDeletionService', () => {
  let service: DataDeletionService;
  let voiceDailyRepo: Mocked<Repository<VoiceDailyOrm>>;
  let voiceHistoryRepo: Mocked<Repository<VoiceChannelHistoryOrm>>;
  let coPresenceRepo: Mocked<Repository<VoiceCoPresencePairDailyOrm>>;

  beforeEach(() => {
    voiceDailyRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<VoiceDailyOrm>>;

    voiceHistoryRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<VoiceChannelHistoryOrm>>;

    coPresenceRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Mocked<Repository<VoiceCoPresencePairDailyOrm>>;

    service = new DataDeletionService(voiceDailyRepo, voiceHistoryRepo, coPresenceRepo);
  });

  describe('deleteUserData', () => {
    it('3개 테이블의 삭제를 병렬로 실행하고 결과를 반환한다', async () => {
      const dailyQb = makeDeleteQb(5);
      const historyQb = makeDeleteQb(3);
      const coPresenceQb = makeDeleteQb(2);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      const result = await service.deleteUserData('user-discord-id');

      expect(result).toEqual({
        voiceDaily: 5,
        voiceHistory: 3,
        coPresence: 2,
      });
    });

    it('3개 테이블 모두에서 삭제 쿼리가 실행된다', async () => {
      const dailyQb = makeDeleteQb(0);
      const historyQb = makeDeleteQb(0);
      const coPresenceQb = makeDeleteQb(0);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      await service.deleteUserData('user-discord-id');

      expect(dailyQb.execute).toHaveBeenCalledTimes(1);
      expect(historyQb.execute).toHaveBeenCalledTimes(1);
      expect(coPresenceQb.execute).toHaveBeenCalledTimes(1);
    });

    it('affected가 null이면 해당 테이블의 결과는 0이다', async () => {
      const dailyQb = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: null } as unknown as DeleteResult),
      };
      const historyQb = makeDeleteQb(0);
      const coPresenceQb = makeDeleteQb(0);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      const result = await service.deleteUserData('user-discord-id');

      expect(result.voiceDaily).toBe(0);
    });

    it('음성 데이터가 없으면 모든 결과가 0이다', async () => {
      const dailyQb = makeDeleteQb(0);
      const historyQb = makeDeleteQb(0);
      const coPresenceQb = makeDeleteQb(0);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      const result = await service.deleteUserData('no-data-user');

      expect(result).toEqual({
        voiceDaily: 0,
        voiceHistory: 0,
        coPresence: 0,
      });
    });

    it('VoiceDaily 삭제 시 userId 조건이 적용된다', async () => {
      const dailyQb = makeDeleteQb(1);
      const historyQb = makeDeleteQb(0);
      const coPresenceQb = makeDeleteQb(0);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      await service.deleteUserData('target-user');

      expect(dailyQb.where).toHaveBeenCalledWith('userId = :discordId', {
        discordId: 'target-user',
      });
    });

    it('CoPresence 삭제 시 userId 또는 peerId 조건이 적용된다', async () => {
      const dailyQb = makeDeleteQb(0);
      const historyQb = makeDeleteQb(0);
      const coPresenceQb = makeDeleteQb(2);

      voiceDailyRepo.createQueryBuilder.mockReturnValue(
        dailyQb as ReturnType<typeof voiceDailyRepo.createQueryBuilder>,
      );
      voiceHistoryRepo.createQueryBuilder.mockReturnValue(
        historyQb as ReturnType<typeof voiceHistoryRepo.createQueryBuilder>,
      );
      coPresenceRepo.createQueryBuilder.mockReturnValue(
        coPresenceQb as ReturnType<typeof coPresenceRepo.createQueryBuilder>,
      );

      await service.deleteUserData('target-user');

      expect(coPresenceQb.where).toHaveBeenCalledWith(
        'userId = :discordId OR peerId = :discordId',
        { discordId: 'target-user' },
      );
    });
  });
});
