import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    if (token.startsWith('nw_')) {
      void import('../domains/platform/prisma-store')
        .then(({ platformStore }) => platformStore.findAccount(token))
        .then((account) => {
          if (!account) {
            res.status(401).json({ success: false, message: 'Invalid or expired token' });
            return;
          }
          req.user = {
            userId: account.id,
            username: account.name,
            email: account.name,
            role: account.role,
            environmentId: account.environmentId,
          } as TokenPayload & { environmentId: string | null };
          next();
        })
        .catch(() => {
          res.status(401).json({ success: false, message: 'Invalid or expired token' });
        });
      return;
    }
    const decoded = verifyAccessToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};
