/**
 * guild-co-presence-config-api.ts 단위 테스트
 *
 * fetchGuildCoPresenceConfig / saveGuildCoPresenceConfig 의 URL 구성,
 * 메서드, 페이로드, 성공/실패 응답 처리를 검증한다.
 *
 * fetch를 직접 모킹하여 네트워크 레이어 의존성을 제거한다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchGuildCoPresenceConfig,
  saveGuildCoPresenceConfig,
} from '../guild-co-presence-config-api';

// ─── fetch 모킹 헬퍼 ────────────────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchError(status: number, message: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify({ message, statusCode: status })),
    json: () => Promise.resolve({ message, statusCode: status }),
  } as unknown as Response);
}

// ─── 픽스처 ────────────────────────────────────────────────────────────────

const GUILD_ID = 'guild-copresence-test';

const CONFIG_OFF_FIXTURE = {
  guildId: GUILD_ID,
  allowPublicAffinityQuery: false,
  updatedAt: '2026-05-04T00:00:00.000Z',
};

const CONFIG_ON_FIXTURE = {
  guildId: GUILD_ID,
  allowPublicAffinityQuery: true,
  updatedAt: '2026-05-04T01:00:00.000Z',
};

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe('fetchGuildCoPresenceConfig', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('URL 구성', () => {
    it('guildId가 URL 경로에 올바르게 포함된다', async () => {
      mockFetchOk(CONFIG_OFF_FIXTURE);

      await fetchGuildCoPresenceConfig(GUILD_ID);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/guilds/${GUILD_ID}/co-presence-config`),
        expect.anything(),
      );
    });
  });

  describe('응답 처리', () => {
    it('정상 응답(200) 시 GuildCoPresenceConfig 객체를 반환한다', async () => {
      mockFetchOk(CONFIG_OFF_FIXTURE);

      const result = await fetchGuildCoPresenceConfig(GUILD_ID);

      expect(result).toEqual(CONFIG_OFF_FIXTURE);
    });

    it('allowPublicAffinityQuery=false 응답을 그대로 반환한다', async () => {
      mockFetchOk(CONFIG_OFF_FIXTURE);

      const result = await fetchGuildCoPresenceConfig(GUILD_ID);

      expect(result.allowPublicAffinityQuery).toBe(false);
    });

    it('allowPublicAffinityQuery=true 응답을 그대로 반환한다', async () => {
      mockFetchOk(CONFIG_ON_FIXTURE);

      const result = await fetchGuildCoPresenceConfig(GUILD_ID);

      expect(result.allowPublicAffinityQuery).toBe(true);
    });

    it('updatedAt 필드가 포함된 응답을 반환한다', async () => {
      mockFetchOk(CONFIG_OFF_FIXTURE);

      const result = await fetchGuildCoPresenceConfig(GUILD_ID);

      expect(result.updatedAt).toBe('2026-05-04T00:00:00.000Z');
    });
  });

  describe('API 실패 처리', () => {
    it('API 실패(401) 시 ApiError를 throw한다', async () => {
      mockFetchError(401, '인증이 필요합니다.');

      await expect(fetchGuildCoPresenceConfig(GUILD_ID)).rejects.toThrow('인증이 필요합니다.');
    });

    it('API 실패(403) 시 ApiError를 throw한다', async () => {
      mockFetchError(403, '이 길드에 접근 권한이 없습니다.');

      await expect(fetchGuildCoPresenceConfig(GUILD_ID)).rejects.toThrow(
        '이 길드에 접근 권한이 없습니다.',
      );
    });

    it('API 실패(404) 시 ApiError를 throw한다', async () => {
      mockFetchError(404, '설정을 찾을 수 없습니다.');

      await expect(fetchGuildCoPresenceConfig(GUILD_ID)).rejects.toThrow(
        '설정을 찾을 수 없습니다.',
      );
    });

    it('API 실패(500) 시 ApiError를 throw한다', async () => {
      mockFetchError(500, '서버 내부 오류');

      await expect(fetchGuildCoPresenceConfig(GUILD_ID)).rejects.toThrow('서버 내부 오류');
    });
  });
});

describe('saveGuildCoPresenceConfig', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('URL 및 메서드 구성', () => {
    it('PUT 메서드로 올바른 엔드포인트를 호출한다', async () => {
      mockFetchOk(CONFIG_ON_FIXTURE);

      await saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/guilds/${GUILD_ID}/co-presence-config`),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('Content-Type: application/json 헤더가 포함된다', async () => {
      mockFetchOk(CONFIG_ON_FIXTURE);

      await saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true });

      const calledInit = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
      const headers = calledInit.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('요청 바디', () => {
    it('allowPublicAffinityQuery=true 값이 JSON 바디에 포함된다', async () => {
      mockFetchOk(CONFIG_ON_FIXTURE);

      await saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true });

      const calledInit = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
      const body = JSON.parse(calledInit.body as string) as { allowPublicAffinityQuery: boolean };
      expect(body.allowPublicAffinityQuery).toBe(true);
    });

    it('allowPublicAffinityQuery=false 값이 JSON 바디에 포함된다', async () => {
      mockFetchOk(CONFIG_OFF_FIXTURE);

      await saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: false });

      const calledInit = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
      const body = JSON.parse(calledInit.body as string) as { allowPublicAffinityQuery: boolean };
      expect(body.allowPublicAffinityQuery).toBe(false);
    });
  });

  describe('응답 처리', () => {
    it('정상 응답(200) 시 저장된 GuildCoPresenceConfig 객체를 반환한다', async () => {
      mockFetchOk(CONFIG_ON_FIXTURE);

      const result = await saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true });

      expect(result).toEqual(CONFIG_ON_FIXTURE);
      expect(result.allowPublicAffinityQuery).toBe(true);
    });
  });

  describe('API 실패 처리', () => {
    it('API 실패(400) 시 ApiError를 throw한다', async () => {
      mockFetchError(400, '잘못된 요청입니다.');

      await expect(
        saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true }),
      ).rejects.toThrow('잘못된 요청입니다.');
    });

    it('API 실패(401) 시 ApiError를 throw한다', async () => {
      mockFetchError(401, '인증이 필요합니다.');

      await expect(
        saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: false }),
      ).rejects.toThrow('인증이 필요합니다.');
    });

    it('API 실패(403) 시 ApiError를 throw한다 (ManageGuild 권한 없음)', async () => {
      mockFetchError(403, '서버 관리 권한이 필요합니다.');

      await expect(
        saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: true }),
      ).rejects.toThrow('서버 관리 권한이 필요합니다.');
    });

    it('API 실패(500) 시 ApiError를 throw한다', async () => {
      mockFetchError(500, '서버 내부 오류');

      await expect(
        saveGuildCoPresenceConfig(GUILD_ID, { allowPublicAffinityQuery: false }),
      ).rejects.toThrow('서버 내부 오류');
    });
  });
});
