import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/prisma.js';
import { HttpError } from '../../config/index.js'
import type { AuthRequest, JwtPayload } from '../../config/index.js'
import { JWT_SECRET } from '../../config/index.js';
// Use string-based roles to avoid runtime enum issues
import { logger } from '../utils/logger.js';

// Middleware to verify JWT and attach user data
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  // ... (keeping existing logging)

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // logger.warn(`[Auth:${requestId}] Missing or invalid authorization header`);
      throw new HttpError('Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new HttpError('Authentication token missing', 401);
    }

    // Verify and Decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Fetch the user from the database
    const user = await db.user.findUnique({
      where: { userId: decoded.userId },
      select: {
        userId: true,
        email: true,
        mobileNumber: true,
        passwordHash: true,
        role: true,
        name: true,
        createdAt: true,
        adminForBusinessId: true,
        business: {
          select: {
            businessId: true,
            userId: true,
            businessName: true,
            description: true,
            address: true,
            pinCode: true,
            latitude: true,
            longitude: true,
            googleMapsLink: true,
            createdAt: true,
            approvedAt: true,
            approvedBy: true,
            reviewNote: true,
            status: true,
          }
        }
      },
    });

    if (!user) {
      throw new HttpError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error?.name === 'JsonWebTokenError' ||
      error?.name === 'TokenExpiredError' ||
      error?.name === 'NotBeforeError') {
      return next(new HttpError('Invalid or expired token', 401));
    }
    next(error);
  }
};

// Optional Auth Middleware (does not throw if unauthenticated)
export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        const user = await db.user.findUnique({
          where: { userId: decoded.userId },
          select: { userId: true, role: true } // Minimal select
        });
        if (user) {
          req.user = user as any;
        }
      }
    }
    next();
  } catch (error) {
    // Ignore errors for optional auth, just proceed as guest
    next();
  }
};

// Middleware for role-based access control
export const roleMiddleware = (requiredRole: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const requestId = Math.random().toString(36).substring(7);
    logger.debug(`[Role:${requestId}] Authorization check for ${req.method} ${req.originalUrl} - Required role: ${requiredRole}`);

    // Assuming authMiddleware has run and req.user is populated
    if (!req.user) {
      logger.warn(`[Role:${requestId}] Authorization failed - No user attached to request`);
      return next(new HttpError('Forbidden: Insufficient permissions', 403));
    }

    if (req.user.role !== requiredRole) {
      logger.warn(`[Role:${requestId}] Authorization failed - User ${req.user.email} has role ${req.user.role}, required: ${requiredRole}`);
      return next(new HttpError('Forbidden: Insufficient permissions', 403));
    }

    logger.info(`[Role:${requestId}] Authorization successful - User ${req.user.email} has required role: ${requiredRole}`);
    next();
  };
};

// Middleware for allowing multiple roles
export const rolesMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const requestId = Math.random().toString(36).substring(7);
    logger.debug(`[Role:${requestId}] Authorization check for ${req.method} ${req.originalUrl} - Allowed roles: ${allowedRoles.join(', ')}`);

    if (!req.user) {
      logger.warn(`[Role:${requestId}] Authorization failed - No user attached to request`);
      return next(new HttpError('Forbidden: Insufficient permissions', 403));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`[Role:${requestId}] Authorization failed - User ${req.user.email} has role ${req.user.role}, allowed: ${allowedRoles.join(', ')}`);
      return next(new HttpError('Forbidden: Insufficient permissions', 403));
    }

    logger.info(`[Role:${requestId}] Authorization successful - User ${req.user.email} has allowed role: ${req.user.role}`);
    next();
  };
};