import { Request, Response, NextFunction } from 'express';

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

function clientIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(options: {
  keyPrefix: string;
  windowMs: number;
  max: number;
}) {
  const { keyPrefix, windowMs, max } = options;
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${keyPrefix}:${clientIp(req)}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (current.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
      return;
    }
    current.count += 1;
    buckets.set(key, current);
    next();
  };
}
