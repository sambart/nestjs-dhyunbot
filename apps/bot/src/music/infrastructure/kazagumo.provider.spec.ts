import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { KazagumoProvider } from './kazagumo.provider';

// Kazagumo 생성자 mock — vi.mock은 모듈 경계에서 호이스팅되므로 전략적으로 사용
// KazagumoProvider는 onModuleInit에서 new Kazagumo(...)를 호출한다.
// 외부 라이브러리 kazagumo와 shoukaku를 mock으로 대체한다.

// Shoukaku 이벤트 에미터 mock
function makeShoukakuMock() {
  return {
    on: vi.fn(),
  };
}

// Kazagumo 인스턴스 mock
function makeKazagumoInstanceMock(players?: Map<string, unknown>) {
  const shoukaku = makeShoukakuMock();
  const kazagumoPlayers = players ?? new Map();

  return {
    shoukaku,
    players: kazagumoPlayers,
    on: vi.fn(),
    destroyPlayer: vi.fn(),
  };
}

// Kazagumo 생성자 mock을 위해 kazagumo 모듈 전체를 mock 처리
vi.mock('kazagumo', () => {
  const mockInstance = makeKazagumoInstanceMock();

  // 생성자를 mock으로 대체: 항상 같은 인스턴스를 반환
  const KazagumoMock = vi.fn().mockReturnValue(mockInstance);

  return {
    Kazagumo: KazagumoMock,
    // 다른 export는 그냥 통과
    Connectors: undefined,
  };
});

vi.mock('shoukaku', () => ({
  Connectors: {
    DiscordJS: vi.fn().mockImplementation(() => ({})),
  },
}));

// mock된 Kazagumo 생성자에 접근하기 위해 dynamic import 사용
// (vi.mock이 호이스팅되므로 import문은 테스트 파일 상단에서 처리됨)
import { Kazagumo } from 'kazagumo';

describe('KazagumoProvider', () => {
  let provider: KazagumoProvider;
  let mockClient: {
    guilds: { cache: { get: Mock } };
  };
  let mockConfigService: {
    getOrThrow: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      guilds: {
        cache: {
          get: vi.fn(),
        },
      },
    };

    mockConfigService = {
      getOrThrow: vi.fn().mockImplementation((key: string) => {
        if (key === 'LAVALINK_URL') return 'lavalink:2333';
        if (key === 'LAVALINK_PASSWORD') return 'youshallnotpass';
        throw new Error(`Unknown config key: ${key}`);
      }),
    };

    provider = new KazagumoProvider(mockClient as never, mockConfigService as never);
  });

  // ─────────────────────────────────────────────────────────
  // onModuleInit
  // ─────────────────────────────────────────────────────────
  describe('onModuleInit', () => {
    it('Kazagumo 인스턴스를 생성한다', async () => {
      await provider.onModuleInit();

      expect(Kazagumo).toHaveBeenCalledTimes(1);
    });

    it('ConfigService에서 LAVALINK_URL과 LAVALINK_PASSWORD를 읽어온다', async () => {
      await provider.onModuleInit();

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('LAVALINK_URL');
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith('LAVALINK_PASSWORD');
    });

    it('Kazagumo 생성 시 Lavalink 노드 설정이 올바르게 전달된다', async () => {
      await provider.onModuleInit();

      const callArgs = (Kazagumo as Mock).mock.calls[0];
      // 세 번째 인자: 노드 배열
      const nodes = callArgs[2] as Array<{ name: string; url: string; auth: string; secure: boolean }>;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Lavalink');
      expect(nodes[0].url).toBe('lavalink:2333');
      expect(nodes[0].auth).toBe('youshallnotpass');
      expect(nodes[0].secure).toBe(false);
    });

    it('이벤트 리스너가 등록된다 (shoukaku: ready, error, close / kazagumo: playerStart, playerEmpty)', async () => {
      await provider.onModuleInit();

      const instance = (Kazagumo as Mock).mock.results[0].value;
      // shoukaku 이벤트
      expect(instance.shoukaku.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(instance.shoukaku.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(instance.shoukaku.on).toHaveBeenCalledWith('close', expect.any(Function));
      // kazagumo 이벤트
      expect(instance.on).toHaveBeenCalledWith('playerStart', expect.any(Function));
      expect(instance.on).toHaveBeenCalledWith('playerEmpty', expect.any(Function));
    });
  });

  // ─────────────────────────────────────────────────────────
  // getInstance
  // ─────────────────────────────────────────────────────────
  describe('getInstance', () => {
    it('onModuleInit 이후 Kazagumo 인스턴스를 반환한다', async () => {
      await provider.onModuleInit();

      const instance = provider.getInstance();

      // Kazagumo mock이 반환한 인스턴스와 동일해야 함
      const expectedInstance = (Kazagumo as Mock).mock.results[0].value;
      expect(instance).toBe(expectedInstance);
    });
  });

  // ─────────────────────────────────────────────────────────
  // onApplicationShutdown
  // ─────────────────────────────────────────────────────────
  describe('onApplicationShutdown', () => {
    it('모든 플레이어에 대해 destroyPlayer를 호출한다', async () => {
      // Kazagumo mock 인스턴스에 플레이어를 추가
      const players = new Map<string, unknown>([
        ['guild-1', {}],
        ['guild-2', {}],
        ['guild-3', {}],
      ]);

      // kazagumo 모듈 mock을 재구성하여 players가 포함된 인스턴스를 반환하게 설정
      const mockInstance = makeKazagumoInstanceMock(players);
      (Kazagumo as Mock).mockReturnValueOnce(mockInstance);

      await provider.onModuleInit();
      await provider.onApplicationShutdown();

      expect(mockInstance.destroyPlayer).toHaveBeenCalledTimes(3);
      expect(mockInstance.destroyPlayer).toHaveBeenCalledWith('guild-1');
      expect(mockInstance.destroyPlayer).toHaveBeenCalledWith('guild-2');
      expect(mockInstance.destroyPlayer).toHaveBeenCalledWith('guild-3');
    });

    it('플레이어가 없으면 destroyPlayer를 호출하지 않는다', async () => {
      await provider.onModuleInit();
      const instance = (Kazagumo as Mock).mock.results[0].value;
      instance.players = new Map(); // 플레이어 없음

      await provider.onApplicationShutdown();

      expect(instance.destroyPlayer).not.toHaveBeenCalled();
    });

    it('kazagumo 인스턴스가 초기화되지 않은 상태에서는 오류 없이 종료된다', async () => {
      // onModuleInit을 호출하지 않아 kazagumo가 undefined 상태
      await expect(provider.onApplicationShutdown()).resolves.not.toThrow();
    });
  });
});
