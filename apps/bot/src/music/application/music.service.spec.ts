import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { DEFAULT_VOLUME } from '../music.constants';
import { MusicService } from './music.service';

// KazagumoPlayer mock 팩토리
function makePlayer(overrides: {
  guildId?: string;
  playing?: boolean;
  paused?: boolean;
  position?: number;
  queueCurrent?: object | null;
} = {}) {
  return {
    guildId: overrides.guildId ?? 'guild-1',
    playing: overrides.playing ?? true,
    paused: overrides.paused ?? false,
    position: overrides.position ?? 0,
    queue: {
      current: overrides.queueCurrent !== undefined ? overrides.queueCurrent : { title: '현재 트랙' },
      add: vi.fn(),
      clear: vi.fn(),
    },
    play: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn(),
    pause: vi.fn(),
  };
}

// KazagumoSearchResult mock 팩토리
function makeSearchResult(overrides: {
  type?: string;
  tracks?: Array<{ title: string }>;
} = {}) {
  return {
    type: overrides.type ?? 'TRACK',
    tracks: overrides.tracks ?? [{ title: '테스트 트랙' }],
  };
}

describe('MusicService', () => {
  let service: MusicService;
  let mockKazagumoProvider: {
    getInstance: Mock;
  };
  let mockKazagumo: {
    search: Mock;
    players: Map<string, ReturnType<typeof makePlayer>>;
    createPlayer: Mock;
    destroyPlayer: Mock;
  };

  beforeEach(() => {
    mockKazagumo = {
      search: vi.fn(),
      players: new Map(),
      createPlayer: vi.fn(),
      destroyPlayer: vi.fn(),
    };

    mockKazagumoProvider = {
      getInstance: vi.fn().mockReturnValue(mockKazagumo),
    };

    service = new MusicService(mockKazagumoProvider as never);
  });

  // ─────────────────────────────────────────────────────────
  // play
  // ─────────────────────────────────────────────────────────
  describe('play', () => {
    const baseParams = {
      query: '테스트 노래',
      guildId: 'guild-1',
      textChannelId: 'text-1',
      voiceChannelId: 'voice-1',
      requesterId: 'user-1',
    };

    it('단일 트랙 검색 후 큐에 추가하고 PlayResult를 반환한다', async () => {
      const track = { title: '봄날' };
      const searchResult = makeSearchResult({ type: 'TRACK', tracks: [track] });
      mockKazagumo.search.mockResolvedValue(searchResult);

      const player = makePlayer({ playing: false, paused: false });
      mockKazagumo.createPlayer.mockResolvedValue(player);

      const result = await service.play(baseParams);

      expect(result.isPlaylist).toBe(false);
      expect(result.trackCount).toBe(1);
      expect(result.firstTrack.title).toBe('봄날');
      expect(player.queue.add).toHaveBeenCalledWith(track);
    });

    it('검색 결과가 없으면 "Track not found" 에러를 throw한다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult({ tracks: [] }));

      await expect(service.play(baseParams)).rejects.toThrow('Track not found');
    });

    it('플레이리스트 URL이면 전체 트랙을 일괄 큐에 추가한다', async () => {
      const tracks = [{ title: '트랙1' }, { title: '트랙2' }, { title: '트랙3' }];
      mockKazagumo.search.mockResolvedValue(makeSearchResult({ type: 'PLAYLIST', tracks }));

      const player = makePlayer({ playing: false, paused: false });
      mockKazagumo.createPlayer.mockResolvedValue(player);

      const result = await service.play(baseParams);

      expect(result.isPlaylist).toBe(true);
      expect(result.trackCount).toBe(3);
      expect(player.queue.add).toHaveBeenCalledTimes(3);
      expect(player.queue.add).toHaveBeenCalledWith(tracks[0]);
      expect(player.queue.add).toHaveBeenCalledWith(tracks[1]);
      expect(player.queue.add).toHaveBeenCalledWith(tracks[2]);
    });

    it('기존 플레이어가 없으면 새 플레이어를 DEFAULT_VOLUME으로 생성한다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const player = makePlayer({ playing: false, paused: false });
      mockKazagumo.createPlayer.mockResolvedValue(player);

      await service.play(baseParams);

      expect(mockKazagumo.createPlayer).toHaveBeenCalledWith({
        guildId: 'guild-1',
        textId: 'text-1',
        voiceId: 'voice-1',
        volume: DEFAULT_VOLUME,
      });
    });

    it('기존 플레이어가 있으면 createPlayer를 호출하지 않고 재사용한다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const existingPlayer = makePlayer({ playing: true, paused: false });
      mockKazagumo.players.set('guild-1', existingPlayer);

      await service.play(baseParams);

      expect(mockKazagumo.createPlayer).not.toHaveBeenCalled();
    });

    it('재생 중이 아니고 일시정지도 아니면 play()를 호출한다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const player = makePlayer({ playing: false, paused: false });
      mockKazagumo.createPlayer.mockResolvedValue(player);

      await service.play(baseParams);

      expect(player.play).toHaveBeenCalled();
    });

    it('이미 재생 중이면 play()를 호출하지 않는다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const player = makePlayer({ playing: true, paused: false });
      mockKazagumo.players.set('guild-1', player);

      await service.play(baseParams);

      expect(player.play).not.toHaveBeenCalled();
    });

    it('일시정지 상태이면 play()를 호출하지 않는다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const player = makePlayer({ playing: false, paused: true });
      mockKazagumo.players.set('guild-1', player);

      await service.play(baseParams);

      expect(player.play).not.toHaveBeenCalled();
    });

    it('검색 시 requesterId를 requester로 전달한다', async () => {
      mockKazagumo.search.mockResolvedValue(makeSearchResult());
      const player = makePlayer({ playing: false, paused: false });
      mockKazagumo.createPlayer.mockResolvedValue(player);

      await service.play({ ...baseParams, requesterId: 'user-99' });

      expect(mockKazagumo.search).toHaveBeenCalledWith('테스트 노래', { requester: { id: 'user-99' } });
    });
  });

  // ─────────────────────────────────────────────────────────
  // skip
  // ─────────────────────────────────────────────────────────
  describe('skip', () => {
    it('현재 트랙을 건너뛰고 플레이어와 nextTrack을 반환한다', async () => {
      const player = makePlayer();
      mockKazagumo.players.set('guild-1', player);

      const result = await service.skip('guild-1');

      expect(player.skip).toHaveBeenCalled();
      expect(result.player).toBe(player);
    });

    it('활성 플레이어가 없으면 "No active player" 에러를 throw한다', async () => {
      // players Map이 비어있음

      await expect(service.skip('guild-1')).rejects.toThrow('No active player');
    });

    it('현재 재생 중인 트랙이 없으면 "No active player" 에러를 throw한다', async () => {
      const player = makePlayer({ queueCurrent: null });
      mockKazagumo.players.set('guild-1', player);

      await expect(service.skip('guild-1')).rejects.toThrow('No active player');
    });
  });

  // ─────────────────────────────────────────────────────────
  // stop
  // ─────────────────────────────────────────────────────────
  describe('stop', () => {
    it('큐를 클리어하고 destroyPlayer를 호출한다', () => {
      const player = makePlayer();
      mockKazagumo.players.set('guild-1', player);

      service.stop('guild-1');

      expect(player.queue.clear).toHaveBeenCalled();
      expect(mockKazagumo.destroyPlayer).toHaveBeenCalledWith('guild-1');
    });

    it('플레이어가 없으면 "No active player" 에러를 throw한다', () => {
      expect(() => service.stop('guild-1')).toThrow('No active player');
    });

    it('에러 발생 시 destroyPlayer는 호출되지 않는다', () => {
      // players Map이 비어있어 에러 발생

      expect(() => service.stop('guild-1')).toThrow();
      expect(mockKazagumo.destroyPlayer).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // pause
  // ─────────────────────────────────────────────────────────
  describe('pause', () => {
    it('정상적으로 일시정지하고 플레이어를 반환한다', () => {
      const player = makePlayer({ paused: false });
      mockKazagumo.players.set('guild-1', player);

      const result = service.pause('guild-1');

      expect(player.pause).toHaveBeenCalledWith(true);
      expect(result).toBe(player);
    });

    it('이미 일시정지 상태이면 "Already paused" 에러를 throw한다', () => {
      const player = makePlayer({ paused: true });
      mockKazagumo.players.set('guild-1', player);

      expect(() => service.pause('guild-1')).toThrow('Already paused');
    });

    it('활성 플레이어가 없으면 "No active player" 에러를 throw한다', () => {
      expect(() => service.pause('guild-1')).toThrow('No active player');
    });

    it('이미 일시정지 상태일 때 pause(true)를 호출하지 않는다', () => {
      const player = makePlayer({ paused: true });
      mockKazagumo.players.set('guild-1', player);

      expect(() => service.pause('guild-1')).toThrow();
      expect(player.pause).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────
  // resume
  // ─────────────────────────────────────────────────────────
  describe('resume', () => {
    it('정상적으로 재개하고 플레이어를 반환한다', () => {
      const player = makePlayer({ paused: true });
      mockKazagumo.players.set('guild-1', player);

      const result = service.resume('guild-1');

      expect(player.pause).toHaveBeenCalledWith(false);
      expect(result).toBe(player);
    });

    it('일시정지 상태가 아니면 "Not paused" 에러를 throw한다', () => {
      const player = makePlayer({ paused: false });
      mockKazagumo.players.set('guild-1', player);

      expect(() => service.resume('guild-1')).toThrow('Not paused');
    });

    it('활성 플레이어가 없으면 "No active player" 에러를 throw한다', () => {
      expect(() => service.resume('guild-1')).toThrow('No active player');
    });

    it('일시정지 상태가 아닐 때 pause(false)를 호출하지 않는다', () => {
      const player = makePlayer({ paused: false });
      mockKazagumo.players.set('guild-1', player);

      expect(() => service.resume('guild-1')).toThrow();
      expect(player.pause).not.toHaveBeenCalled();
    });
  });
});
