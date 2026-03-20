/**
 * RedisService 목 구현체.
 * 인메모리 Map으로 Redis 동작을 시뮬레이션한다.
 */
export class MockRedisService {
  private store = new Map<string, string>();

  async get<T = string>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown, _ttlSeconds?: number): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter((k) => regex.test(k));
  }

  async incrBy(key: string, value: number): Promise<number> {
    const current = parseInt(this.store.get(key) ?? '0', 10);
    const next = current + value;
    this.store.set(key, String(next));
    return next;
  }

  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    return keys.map((k) => {
      const v = this.store.get(k);
      return v ? (JSON.parse(v) as T) : null;
    });
  }

  async pipeline(
    build: (pipe: Record<string, unknown>) => void,
  ): Promise<Array<[Error | null, unknown]>> {
    const results: Array<[Error | null, unknown]> = [];
    const pipe = new Proxy(
      {},
      {
        get:
          () =>
          (..._args: unknown[]) => {
            results.push([null, 'OK']);
            return pipe;
          },
      },
    );
    build(pipe as never);
    return results;
  }

  async ttl(_key: string): Promise<number> {
    return -1;
  }

  async sadd(_key: string, _member: string | string[]): Promise<number> {
    return 1;
  }

  async srem(_key: string, _member: string | string[]): Promise<number> {
    return 1;
  }

  async sismember(_key: string, _member: string): Promise<boolean> {
    return false;
  }

  async scard(_key: string): Promise<number> {
    return 0;
  }

  async hIncrBy(_key: string, _field: string, _value: number): Promise<number> {
    return 0;
  }

  async expireAt(_key: string, _timestamp: number): Promise<void> {}

  /** 테스트 후 상태 초기화 */
  clear(): void {
    this.store.clear();
  }
}
