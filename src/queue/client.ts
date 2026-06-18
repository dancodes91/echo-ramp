import Redis from 'ioredis';
import { config } from '../config/index.js';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/** Phase 0 stub — queue processors wired in later phases */
export async function publishEvent(_channel: string, _payload: unknown): Promise<void> {
  throw new Error('Not implemented — Phase 0 stub');
}
