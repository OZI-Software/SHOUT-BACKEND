import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/prisma.js';
import { HttpError } from '../../config/index.js'
import type {AuthRequest, JwtPayload} from '../../config/index.js'
import { JWT_SECRET } from '../../config/index.d.js';
import { userRole } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Middleware to verify JWT and attach user data
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.debug(`[Auth:${requestId}] Authentication attempt for ${req.method} ${req.originalUrl}`);
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`[Auth:${requestId}] Missing or invalid authorization header`);
      throw new HttpError('Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn(`[Auth:${requestId}] Token extraction failed from authorization header`);
      throw new HttpError('Authentication token missing', 401);
    }

    logger.debug(`[Auth:${requestId}] Token extracted, verifying JWT`);

    // 1. Verify and Decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    logger.debug(`[Auth:${requestId}] JWT verified successfully for userId: ${decoded.userId}`);

    // 2. Fetch the user from the database
    logger.debug(`[Auth:${requestId}] Fetching user data from database for userId: ${decoded.userId}`);
    const user = await db.user.findUnique({
      where: { userId: decoded.userId },
      // Select only necessary/safe fields
      select: { userId: true, email: true, role: true, createdAt: true, business: true },
    });

    if (!user) {
      logger.warn(`[Auth:${requestId}] User not found in database for userId: ${decoded.userId}`);
      throw new HttpError('User not found', 401);
    }

    logger.info(`[Auth:${requestId}] Authentication successful for user: ${user.email} (${user.role})`);

    // 3. Attach user object to the request
    req.user = user;
    next();
  } catch (error: any) {
    // Handle JWT errors (e.g., expired, invalid signature)
    if (error?.name === 'JsonWebTokenError' || 
        error?.name === 'TokenExpiredError' || 
        error?.name === 'NotBeforeError') {
      logger.warn(`[Auth:${requestId}] JWT verification failed: ${error.message}`);
      return next(new HttpError('Invalid or expired token', 401));
    }
    logger.error(`[Auth:${requestId}] Authentication error:`, error);
    next(error); // Pass other errors to the error middleware
  }
};

// Middleware for role-based access control
export const roleMiddleware = (requiredRole: userRole) => {
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