import { Redis } from 'ioredis';

/**
 * Producer-side connection: commands fail fast while Redis is unreachable instead of piling up
 * in the offline queue, so requests get a prompt 503 rather than hanging.
 * Connection errors are logged through the BullMQ queue that shares this client.
 */
export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 1 });
}

export async function closeRedis(redis: Redis): Promise<void> {
  if (redis.status === 'ready') {
    await redis.quit();
  } else {
    redis.disconnect();
  }
}
