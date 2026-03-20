import { createResiliencePolicy } from './resilience.policy';

describe('ResiliencePolicy', () => {
  it('성공하는 함수를 정상 실행한다', async () => {
    const policy = createResiliencePolicy({ maxRetries: 1 });
    const result = await policy.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('일시적 실패 후 재시도하여 성공한다', async () => {
    const policy = createResiliencePolicy({
      maxRetries: 2,
      retryBaseDelayMs: 10,
    });

    let callCount = 0;
    const result = await policy.execute(() => {
      callCount++;
      if (callCount === 1) throw new Error('transient');
      return Promise.resolve('recovered');
    });

    expect(result).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('재시도 횟수 초과 시 예외를 throw한다', async () => {
    const policy = createResiliencePolicy({
      maxRetries: 1,
      retryBaseDelayMs: 10,
      consecutiveFailures: 10, // circuit breaker가 열리지 않도록
    });

    await expect(policy.execute(() => Promise.reject(new Error('persistent')))).rejects.toThrow(
      'persistent',
    );
  });
});
