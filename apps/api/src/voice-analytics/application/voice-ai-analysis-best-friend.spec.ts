/**
 * VoiceAiAnalysisService.generateBestFriendComment 단위 테스트
 * 대상: T-LLM-01 ~ T-LLM-04
 *
 * LlmProvider, RedisService는 vi.fn()으로 대체한다.
 */

import type { Mock } from 'vitest';

import type { LlmProvider } from '../../common/llm/llm-provider.interface';
import type { RedisService } from '../../redis/redis.service';
import { VoiceAiAnalysisService } from './voice-ai-analysis.service';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** PRD 및 구현체에서 일일 한도로 정의된 값 */
const FRIEND_LLM_DAILY_QUOTA = 50;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeContext(
  overrides: Partial<Parameters<VoiceAiAnalysisService['generateBestFriendComment']>[0]> = {},
) {
  return {
    guildId: 'guild-1',
    selfDisplayName: '동현',
    period: 30 as const,
    topPeers: [
      { displayName: '민수', totalMinutes: 720, sessionCount: 24 },
      { displayName: '지수', totalMinutes: 492, sessionCount: 15 },
      { displayName: '영희', totalMinutes: 360, sessionCount: 10 },
    ],
    ...overrides,
  };
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

describe('VoiceAiAnalysisService.generateBestFriendComment', () => {
  let service: VoiceAiAnalysisService;
  let llmProvider: { generateText: Mock } & LlmProvider;
  let redisService: Partial<RedisService>;

  beforeEach(() => {
    llmProvider = { generateText: vi.fn() };
    redisService = {
      incrBy: vi.fn().mockResolvedValue(1), // 기본: 첫 번째 호출
      expireAt: vi.fn().mockResolvedValue(undefined),
    };
    service = new VoiceAiAnalysisService(llmProvider, redisService as RedisService);
    vi.clearAllMocks();
  });

  it('T-LLM-01: 정상 호출 — LLM 결과 문자열 반환, Redis INCR 1회 호출', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(1);
    (llmProvider.generateText as Mock).mockResolvedValue('  민수님과 자주 어울리시네요.  ');

    const result = await service.generateBestFriendComment(makeContext());

    expect(result).toBe('민수님과 자주 어울리시네요.'); // trim 적용
    expect(redisService.incrBy).toHaveBeenCalledTimes(1);
    // Redis 키가 friend:llm:quota:{guildId}:{YYYYMMDD} 형식이어야 한다
    const keyArg = (redisService.incrBy as Mock).mock.calls[0][0] as string;
    expect(keyArg).toMatch(/^friend:llm:quota:guild-1:\d{8}$/);
  });

  it('T-LLM-02: 한도 초과(51번째 호출) 시 null 반환, LLM 호출 없음', async () => {
    // 51회: FRIEND_LLM_DAILY_QUOTA(50) 초과
    (redisService.incrBy as Mock).mockResolvedValue(FRIEND_LLM_DAILY_QUOTA + 1);

    const result = await service.generateBestFriendComment(makeContext());

    expect(result).toBeNull();
    expect(llmProvider.generateText).not.toHaveBeenCalled();
  });

  it('T-LLM-03: LLM throw 시 null 반환 (카운터는 이미 INCR된 상태)', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(1);
    (llmProvider.generateText as Mock).mockRejectedValue(new Error('LLM 오류'));

    const result = await service.generateBestFriendComment(makeContext());

    expect(result).toBeNull();
    // 카운터는 LLM 호출 전에 이미 증가됨
    expect(redisService.incrBy).toHaveBeenCalledTimes(1);
  });

  it('T-LLM-04: 첫 번째 호출(count=1) 시 INCR + EXPIRE 24h 설정 호출', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(1); // count=1: 첫 호출
    (llmProvider.generateText as Mock).mockResolvedValue('코멘트');

    await service.generateBestFriendComment(makeContext());

    // INCR 후 count===1이면 expireAt을 호출해야 한다
    expect(redisService.expireAt).toHaveBeenCalledTimes(1);
    // expireAt에 전달된 타임스탬프가 현재 시각보다 크고 24h + 약간의 여유 이내
    const tsArg = (redisService.expireAt as Mock).mock.calls[0][1] as number;
    const now = Math.floor(Date.now() / 1000);
    const expectedExpiry = now + 24 * 60 * 60;
    expect(tsArg).toBeGreaterThanOrEqual(now);
    expect(tsArg).toBeLessThanOrEqual(expectedExpiry + 5); // 5초 여유
  });

  it('두 번째 이후 호출(count>1) 시 expireAt 미호출', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(2); // count=2: 두 번째 호출
    (llmProvider.generateText as Mock).mockResolvedValue('코멘트');

    await service.generateBestFriendComment(makeContext());

    expect(redisService.expireAt).not.toHaveBeenCalled();
  });

  it('정확히 한도(50회)에서는 LLM을 호출한다 (초과 아님)', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(FRIEND_LLM_DAILY_QUOTA);
    (llmProvider.generateText as Mock).mockResolvedValue('코멘트');

    const result = await service.generateBestFriendComment(makeContext());

    expect(llmProvider.generateText).toHaveBeenCalledTimes(1);
    expect(result).toBe('코멘트');
  });

  it('maxOutputTokens: 256, thinkingBudget: 0 옵션으로 LLM 호출', async () => {
    (redisService.incrBy as Mock).mockResolvedValue(1);
    (llmProvider.generateText as Mock).mockResolvedValue('코멘트');

    await service.generateBestFriendComment(makeContext());

    expect(llmProvider.generateText).toHaveBeenCalledWith(expect.any(String), {
      maxOutputTokens: 256,
      thinkingBudget: 0,
    });
  });
});
