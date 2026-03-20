import {
  circuitBreaker,
  type CircuitBreakerPolicy,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  timeout,
  TimeoutStrategy,
  wrap,
} from 'cockatiel';

export interface ResiliencePolicyOptions {
  /** 타임아웃 (ms). 기본 10000 */
  timeoutMs?: number;
  /** 최대 재시도 횟수. 기본 2 */
  maxRetries?: number;
  /** 재시도 초기 지연 (ms). 기본 1000 */
  retryBaseDelayMs?: number;
  /** 서킷 오픈 조건: 연속 실패 횟수. 기본 5 */
  consecutiveFailures?: number;
  /** 서킷 반개방까지 대기 (ms). 기본 60000 */
  halfOpenAfterMs?: number;
}

const DEFAULT_OPTIONS: Required<ResiliencePolicyOptions> = {
  timeoutMs: 10000,
  maxRetries: 2,
  retryBaseDelayMs: 1000,
  consecutiveFailures: 5,
  halfOpenAfterMs: 60000,
};

export interface ResiliencePolicy {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  circuitBreaker: CircuitBreakerPolicy;
}

/**
 * 외부 API 호출을 위한 resilience 정책을 생성한다.
 * timeout → retry → circuit breaker 순서로 래핑된다.
 */
export function createResiliencePolicy(opts?: ResiliencePolicyOptions): ResiliencePolicy {
  const o = { ...DEFAULT_OPTIONS, ...opts };

  const timeoutPolicy = timeout(o.timeoutMs, TimeoutStrategy.Cooperative);

  const retryPolicy = retry(handleAll, {
    maxAttempts: o.maxRetries,
    backoff: new ExponentialBackoff({ initialDelay: o.retryBaseDelayMs }),
  });

  const breakerPolicy = circuitBreaker(handleAll, {
    halfOpenAfter: o.halfOpenAfterMs,
    breaker: new ConsecutiveBreaker(o.consecutiveFailures),
  });

  const combined = wrap(breakerPolicy, retryPolicy, timeoutPolicy);

  return {
    execute: <T>(fn: () => Promise<T>) => combined.execute((_ctx) => fn()),
    circuitBreaker: breakerPolicy,
  };
}
