import type Redis from 'ioredis';

/** Redis의 모든 키를 삭제한다 */
export async function cleanRedis(client: Redis): Promise<void> {
  await client.flushdb();
}
