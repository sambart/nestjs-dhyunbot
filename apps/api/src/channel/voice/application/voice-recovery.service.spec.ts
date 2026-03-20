import { type Mock } from 'vitest';

import { type VoiceSession } from '../infrastructure/voice-session.keys';
import { VoiceRecoveryService } from './voice-recovery.service';

function makeSession(overrides: Partial<VoiceSession> = {}): VoiceSession {
  return {
    channelId: 'ch-1',
    joinedAt: Date.now() - 60_000,
    mic: true,
    alone: false,
    lastUpdatedAt: Date.now() - 5_000,
    date: '20260318',
    streaming: false,
    videoOn: false,
    selfDeaf: false,
    ...overrides,
  };
}

describe('VoiceRecoveryService', () => {
  let service: VoiceRecoveryService;
  let redis: { scanKeys: Mock };
  let voiceRedisRepository: {
    getSession: Mock;
    accumulateDuration: Mock;
    deleteSession: Mock;
  };
  let flushService: { flushDate: Mock };
  let historyService: { closeOrphanRecords: Mock };

  beforeEach(() => {
    redis = {
      scanKeys: vi.fn(),
    };

    voiceRedisRepository = {
      getSession: vi.fn(),
      accumulateDuration: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    };

    flushService = {
      flushDate: vi.fn().mockResolvedValue(undefined),
    };

    historyService = {
      closeOrphanRecords: vi.fn().mockResolvedValue(undefined),
    };

    service = new VoiceRecoveryService(
      redis as never,
      voiceRedisRepository as never,
      flushService as never,
      historyService as never,
    );

    vi.clearAllMocks();
  });

  describe('onApplicationShutdown', () => {
    it('flushAllActiveSessions와 closeOrphanRecords를 모두 호출한다', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.onApplicationShutdown();

      expect(redis.scanKeys).toHaveBeenCalledWith('voice:session:*');
      expect(historyService.closeOrphanRecords).toHaveBeenCalledTimes(1);
    });

    it('활성 세션이 있으면 각 세션에 대해 accumulateDuration과 flushDate를 호출한다', async () => {
      redis.scanKeys.mockResolvedValue(['voice:session:guild-1:user-1']);
      const session = makeSession();
      voiceRedisRepository.getSession.mockResolvedValue(session);

      await service.onApplicationShutdown();

      expect(voiceRedisRepository.accumulateDuration).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        session,
        expect.any(Number),
      );
      expect(flushService.flushDate).toHaveBeenCalledWith('guild-1', 'user-1', session.date);
    });
  });

  describe('onAppReady', () => {
    it('closeOrphanRecords와 recoverOrphanSessions(scanKeys)를 호출한다', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.onAppReady();

      expect(historyService.closeOrphanRecords).toHaveBeenCalledTimes(1);
      expect(redis.scanKeys).toHaveBeenCalledWith('voice:session:*');
    });
  });

  describe('recoverOrphanSessions (onAppReady를 통해 간접 테스트)', () => {
    it('orphan 세션 없으면 accumulateDuration, flushDate, deleteSession 호출하지 않음', async () => {
      redis.scanKeys.mockResolvedValue([]);

      await service.onAppReady();

      expect(voiceRedisRepository.getSession).not.toHaveBeenCalled();
      expect(voiceRedisRepository.accumulateDuration).not.toHaveBeenCalled();
      expect(flushService.flushDate).not.toHaveBeenCalled();
      expect(voiceRedisRepository.deleteSession).not.toHaveBeenCalled();
    });

    it('orphan 세션 키 스캔 → accumulateDuration → flushDate → deleteSession 순서 처리', async () => {
      redis.scanKeys.mockResolvedValue([
        'voice:session:guild-1:user-1',
        'voice:session:guild-2:user-2',
      ]);
      const session1 = makeSession({ date: '20260318' });
      const session2 = makeSession({ date: '20260317' });
      voiceRedisRepository.getSession
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2);

      await service.onAppReady();

      expect(voiceRedisRepository.accumulateDuration).toHaveBeenCalledTimes(2);
      expect(flushService.flushDate).toHaveBeenCalledWith('guild-1', 'user-1', '20260318');
      expect(flushService.flushDate).toHaveBeenCalledWith('guild-2', 'user-2', '20260317');
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledWith('guild-1', 'user-1');
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledWith('guild-2', 'user-2');
    });

    it('세션이 null이면 해당 키는 skip (나머지는 계속 처리)', async () => {
      redis.scanKeys.mockResolvedValue([
        'voice:session:guild-1:user-null',
        'voice:session:guild-1:user-valid',
      ]);
      const validSession = makeSession();
      voiceRedisRepository.getSession
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(validSession);

      await service.onAppReady();

      // null 세션은 skip, 유효한 세션만 처리
      expect(voiceRedisRepository.accumulateDuration).toHaveBeenCalledTimes(1);
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledTimes(1);
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledWith('guild-1', 'user-valid');
    });

    it('개별 세션 복구 실패해도 나머지 세션 계속 처리 (에러 격리)', async () => {
      redis.scanKeys.mockResolvedValue([
        'voice:session:guild-1:user-fail',
        'voice:session:guild-1:user-ok',
      ]);
      const okSession = makeSession();
      voiceRedisRepository.getSession
        .mockResolvedValueOnce(makeSession())
        .mockResolvedValueOnce(okSession);

      // 첫 번째 세션 처리 시 flushDate에서 에러 발생
      flushService.flushDate
        .mockRejectedValueOnce(new Error('flush failed'))
        .mockResolvedValueOnce(undefined);

      await service.onAppReady();

      // 첫 번째는 실패, 두 번째는 성공
      expect(flushService.flushDate).toHaveBeenCalledTimes(2);
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledTimes(1);
      expect(voiceRedisRepository.deleteSession).toHaveBeenCalledWith('guild-1', 'user-ok');
    });
  });
});
