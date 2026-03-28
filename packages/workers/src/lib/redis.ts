import IORedis from 'ioredis';

let redis: IORedis | null = null;

/**
 * Returns a singleton IORedis connection.
 * Uses REDIS_URL from environment.
 */
export function getRedis(): IORedis {
  if (!redis) {
    const url = process.env['REDIS_URL'];
    if (!url) {
      throw new Error('REDIS_URL environment variable is required');
    }
    redis = new IORedis(url, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });
  }
  return redis;
}

/**
 * Close the Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
