import { type VoiceGameDbRepository } from '../infrastructure/voice-game-db.repository';
import { type VoiceGameRedisRepository } from '../infrastructure/voice-game-redis.repository';
import { type VoiceGameSession } from '../infrastructure/voice-game-session';
import { type MemberGameActivity, VoiceGameService } from './voice-game.service';

/** VoiceGameSession 생성 헬퍼 */
function makeSession(overrides: Partial<VoiceGameSession> = {}): VoiceGameSession {
  return {
    gameName: 'League of Legends',
    applicationId: 'app-123',
    startedAt: Date.now() - 5 * 60 * 1000, // 5분 전
    channelId: 'ch-1',
    ...overrides,
  };
}

describe('VoiceGameService', () => {
  let service: VoiceGameService;
  let redisRepo: jest.Mocked<VoiceGameRedisRepository>;
  let dbRepo: jest.Mocked<VoiceGameDbRepository>;

  beforeEach(() => {
    redisRepo = {
      getGameSession: jest.fn(),
      setGameSession: jest.fn().mockResolvedValue(undefined),
      deleteGameSession: jest.fn().mockResolvedValue(undefined),
      scanAllSessionKeys: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<VoiceGameRedisRepository>;

    dbRepo = {
      saveActivity: jest.fn().mockResolvedValue(undefined),
      upsertDaily: jest.fn().mockResolvedValue(undefined),
      deleteExpiredActivities: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<VoiceGameDbRepository>;

    service = new VoiceGameService(redisRepo, dbRepo);
    jest.clearAllMocks();
  });

  describe('onUserJoined', () => {
    it('입장 시 게임 중이면 Redis에 세션을 저장한다', async () => {
      const activity = { gameName: 'Minecraft', applicationId: 'app-1' };

      await service.onUserJoined('guild-1', 'user-1', 'ch-1', activity);

      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({
          gameName: 'Minecraft',
          applicationId: 'app-1',
          channelId: 'ch-1',
          startedAt: expect.any(Number),
        }),
      );
    });

    it('applicationId가 null인 게임도 세션을 저장한다', async () => {
      const activity = { gameName: 'IndieGame', applicationId: null };

      await service.onUserJoined('guild-1', 'user-1', 'ch-1', activity);

      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({
          gameName: 'IndieGame',
          applicationId: null,
        }),
      );
    });

    it('오류가 발생해도 예외를 throw하지 않는다', async () => {
      redisRepo.setGameSession.mockRejectedValue(new Error('Redis 오류'));
      const activity = { gameName: 'SomeGame', applicationId: null };

      await expect(
        service.onUserJoined('guild-1', 'user-1', 'ch-1', activity),
      ).resolves.not.toThrow();
    });
  });

  describe('onUserLeft', () => {
    it('퇴장 시 게임 세션이 있으면 endSession을 호출한다', async () => {
      const session = makeSession({ startedAt: Date.now() - 5 * 60 * 1000 });
      redisRepo.getGameSession.mockResolvedValue(session);

      await service.onUserLeft('guild-1', 'user-1');

      expect(dbRepo.saveActivity).toHaveBeenCalled();
      expect(redisRepo.deleteGameSession).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    it('퇴장 시 게임 세션이 없으면 DB 저장을 하지 않는다', async () => {
      redisRepo.getGameSession.mockResolvedValue(null);

      await service.onUserLeft('guild-1', 'user-1');

      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
      expect(redisRepo.deleteGameSession).not.toHaveBeenCalled();
    });

    it('오류가 발생해도 예외를 throw하지 않는다', async () => {
      redisRepo.getGameSession.mockRejectedValue(new Error('Redis 오류'));

      await expect(service.onUserLeft('guild-1', 'user-1')).resolves.not.toThrow();
    });
  });

  describe('endSession', () => {
    it('durationMin >= 1이면 DB에 activity를 INSERT하고 daily를 UPSERT한다', async () => {
      const session = makeSession({ startedAt: Date.now() - 5 * 60 * 1000 }); // 5분

      await service.endSession('guild-1', 'user-1', session);

      expect(dbRepo.saveActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          gameName: session.gameName,
          durationMin: expect.any(Number),
        }),
      );
      expect(dbRepo.upsertDaily).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        session.gameName,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.any(Number),
      );
    });

    it('durationMin < 1이면 DB 저장 없이 Redis 키만 삭제한다', async () => {
      const session = makeSession({ startedAt: Date.now() - 30 * 1000 }); // 30초

      await service.endSession('guild-1', 'user-1', session);

      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
      expect(dbRepo.upsertDaily).not.toHaveBeenCalled();
      expect(redisRepo.deleteGameSession).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    it('endSession 후 항상 Redis 게임 세션을 삭제한다', async () => {
      const session = makeSession({ startedAt: Date.now() - 10 * 60 * 1000 }); // 10분

      await service.endSession('guild-1', 'user-1', session);

      expect(redisRepo.deleteGameSession).toHaveBeenCalledWith('guild-1', 'user-1');
    });

    it('durationMin이 정확히 1분이면 DB에 저장한다', async () => {
      // 1분 = 60초
      const session = makeSession({ startedAt: Date.now() - 60 * 1000 });

      await service.endSession('guild-1', 'user-1', session);

      expect(dbRepo.saveActivity).toHaveBeenCalled();
    });

    it('saveActivity에 channelId, startedAt, endedAt이 포함된다', async () => {
      const startedAt = Date.now() - 5 * 60 * 1000;
      const session = makeSession({ startedAt, channelId: 'ch-2' });

      await service.endSession('guild-1', 'user-1', session);

      expect(dbRepo.saveActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'ch-2',
          startedAt: new Date(startedAt),
          endedAt: expect.any(Date),
        }),
      );
    });

    it('date가 YYYY-MM-DD 형식으로 전달된다', async () => {
      const session = makeSession({ startedAt: Date.now() - 5 * 60 * 1000 });

      await service.endSession('guild-1', 'user-1', session);

      const [, , , date] = (dbRepo.upsertDaily as jest.Mock).mock.calls[0] as [
        string,
        string,
        string,
        string,
        number,
      ];
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('reconcileForChannel', () => {
    it('케이스 1: 게임 없음 + 세션 없음 → 스킵', async () => {
      redisRepo.getGameSession.mockResolvedValue(null);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: null,
        applicationId: null,
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      expect(redisRepo.setGameSession).not.toHaveBeenCalled();
      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
    });

    it('케이스 2: 게임 있음 + 세션 없음 → 새 세션 시작', async () => {
      redisRepo.getGameSession.mockResolvedValue(null);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'Valorant',
        applicationId: 'app-v',
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({
          gameName: 'Valorant',
          applicationId: 'app-v',
          channelId: 'ch-1',
        }),
      );
    });

    it('케이스 3: 게임 없음 + 세션 있음 → 세션 종료 (endSession 호출)', async () => {
      const session = makeSession({ startedAt: Date.now() - 10 * 60 * 1000 });
      redisRepo.getGameSession.mockResolvedValue(session);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: null,
        applicationId: null,
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      expect(dbRepo.saveActivity).toHaveBeenCalled();
      expect(redisRepo.deleteGameSession).toHaveBeenCalled();
    });

    it('케이스 4-같은게임: 게임 있음 + 세션 있음 + 같은 게임 → 스킵', async () => {
      const session = makeSession({ gameName: 'PUBG', applicationId: 'app-pubg' });
      redisRepo.getGameSession.mockResolvedValue(session);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'PUBG',
        applicationId: 'app-pubg',
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      expect(redisRepo.setGameSession).not.toHaveBeenCalled();
      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
    });

    it('케이스 4-다른게임: 게임 있음 + 세션 있음 + 다른 게임 → 이전 세션 종료 + 새 세션 시작', async () => {
      const oldSession = makeSession({
        gameName: 'PUBG',
        applicationId: 'app-pubg',
        startedAt: Date.now() - 10 * 60 * 1000,
      });
      redisRepo.getGameSession.mockResolvedValue(oldSession);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'Overwatch',
        applicationId: 'app-ow',
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      // 이전 세션 종료 확인
      expect(dbRepo.saveActivity).toHaveBeenCalledWith(
        expect.objectContaining({ gameName: 'PUBG' }),
      );
      // 새 세션 시작 확인
      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({ gameName: 'Overwatch' }),
      );
    });

    it('여러 멤버에 대해 각각 독립적으로 처리한다', async () => {
      redisRepo.getGameSession.mockResolvedValue(null);
      const activities: MemberGameActivity[] = [
        { userId: 'user-1', gameName: 'Game1', applicationId: null },
        { userId: 'user-2', gameName: 'Game2', applicationId: null },
      ];

      await service.reconcileForChannel('guild-1', 'ch-1', activities);

      expect(redisRepo.setGameSession).toHaveBeenCalledTimes(2);
    });

    it('개별 멤버 처리에서 오류가 발생해도 다른 멤버는 계속 처리한다', async () => {
      redisRepo.getGameSession
        .mockRejectedValueOnce(new Error('Redis 오류'))
        .mockResolvedValueOnce(null);

      const activities: MemberGameActivity[] = [
        { userId: 'user-1', gameName: 'Game1', applicationId: null },
        { userId: 'user-2', gameName: 'Game2', applicationId: null },
      ];

      await expect(
        service.reconcileForChannel('guild-1', 'ch-1', activities),
      ).resolves.not.toThrow();

      // 두 번째 멤버는 정상 처리됨
      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-2',
        expect.objectContaining({ gameName: 'Game2' }),
      );
    });
  });

  describe('게임 동일성 판정 (isSameGame)', () => {
    it('applicationId가 둘 다 있으면 applicationId로 비교한다 (같은 게임)', async () => {
      const session = makeSession({ gameName: 'Game A', applicationId: 'app-1' });
      redisRepo.getGameSession.mockResolvedValue(session);
      // 게임명은 다르지만 applicationId가 같음
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'Game A (Renamed)',
        applicationId: 'app-1',
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      // 같은 게임으로 판정 → 세션 저장 없음
      expect(redisRepo.setGameSession).not.toHaveBeenCalled();
    });

    it('applicationId가 둘 다 있지만 다르면 다른 게임으로 판정한다', async () => {
      const session = makeSession({ gameName: 'Game A', applicationId: 'app-1' });
      redisRepo.getGameSession.mockResolvedValue(session);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'Game B',
        applicationId: 'app-2',
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      // 다른 게임으로 판정 → 세션 전환
      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({ gameName: 'Game B' }),
      );
    });

    it('현재 applicationId가 null이면 gameName으로 비교한다 (같은 게임)', async () => {
      const session = makeSession({ gameName: 'IndiGame', applicationId: 'app-1' });
      redisRepo.getGameSession.mockResolvedValue(session);
      // 현재 활동에는 applicationId가 null
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'IndiGame',
        applicationId: null,
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      // gameName이 같으므로 같은 게임 → 세션 저장 없음
      expect(redisRepo.setGameSession).not.toHaveBeenCalled();
    });

    it('세션 applicationId가 null이면 gameName으로 비교한다 (다른 게임)', async () => {
      const session = makeSession({ gameName: 'Game X', applicationId: null });
      redisRepo.getGameSession.mockResolvedValue(session);
      const memberActivity: MemberGameActivity = {
        userId: 'user-1',
        gameName: 'Game Y',
        applicationId: null,
      };

      await service.reconcileForChannel('guild-1', 'ch-1', [memberActivity]);

      // gameName이 다르므로 다른 게임 → 세션 전환
      expect(redisRepo.setGameSession).toHaveBeenCalledWith(
        'guild-1',
        'user-1',
        expect.objectContaining({ gameName: 'Game Y' }),
      );
    });
  });

  describe('endAllSessions', () => {
    it('모든 게임 세션 키에 대해 endSession을 호출한다', async () => {
      const key1 = 'voice:game:session:guild-1:user-1';
      const key2 = 'voice:game:session:guild-1:user-2';
      redisRepo.scanAllSessionKeys.mockResolvedValue([key1, key2]);

      const session = makeSession({ startedAt: Date.now() - 5 * 60 * 1000 });
      redisRepo.getGameSession.mockResolvedValue(session);

      await service.endAllSessions();

      expect(dbRepo.saveActivity).toHaveBeenCalledTimes(2);
      expect(redisRepo.deleteGameSession).toHaveBeenCalledTimes(2);
    });

    it('세션 키가 없으면 아무 작업도 하지 않는다', async () => {
      redisRepo.scanAllSessionKeys.mockResolvedValue([]);

      await service.endAllSessions();

      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
    });

    it('잘못된 키 형식은 무시한다', async () => {
      redisRepo.scanAllSessionKeys.mockResolvedValue(['invalid:key']);

      await service.endAllSessions();

      expect(dbRepo.saveActivity).not.toHaveBeenCalled();
    });

    it('오류가 발생해도 예외를 throw하지 않는다', async () => {
      redisRepo.scanAllSessionKeys.mockRejectedValue(new Error('Redis 오류'));

      await expect(service.endAllSessions()).resolves.not.toThrow();
    });
  });
});
