import { Request, Response, NextFunction } from 'express';

export function rejectUnknownBodyKeys(allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      next();
      return;
    }

    const unknown = Object.keys(req.body).filter((k) => !allowed.has(k));
    if (unknown.length > 0) {
      res.status(400).json({
        success: false,
        message: `Unknown fields: ${unknown.join(', ')}`,
      });
      return;
    }
    next();
  };
}
