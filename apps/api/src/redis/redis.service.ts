// redis.service.ts
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: Redis,
  ) {}

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async scanKeys(pattern: string, count = 100): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];

    do {
      const [nextCursor, result] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);

      cursor = nextCursor;
      keys.push(...result);
    } while (cursor !== '0');

    return keys;
  }

  async sadd(key: string, member: string | string[]): Promise<number> {
    if (Array.isArray(member)) {
      return this.client.sadd(key, ...member);
    }
    return this.client.sadd(key, member);
  }

  async srem(key: string, member: string | string[]): Promise<number> {
    if (Array.isArray(member)) {
      return this.client.srem(key, ...member);
    }
    return this.client.srem(key, member);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  async incrBy(key: string, value: number): Promise<number> {
    return this.client.incrby(key, value);
  }

  async hIncrBy(key: string, field: string, value: number): Promise<number> {
    return this.client.hincrby(key, field, value);
  }

  async expireAt(key: string, timestamp: number) {
    await this.client.expireat(key, timestamp);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
