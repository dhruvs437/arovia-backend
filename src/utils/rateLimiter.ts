// src/utils/rateLimiter.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const rl = new RateLimiterRedis({
  storeClient: redisClient,
  points: Number(process.env.RATE_LIMIT_REQUESTS || 10),
  duration: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
  keyPrefix: 'rl'
});

export const rateLimitMiddleware = (req: Request & any, res: Response, next: NextFunction) => {
  const key = req.user?.id || req.ip;
  rl.consume(key)
    .then(() => next())
    .catch(() => res.status(429).json({ ok: false, error: 'Too many requests' }));
};
