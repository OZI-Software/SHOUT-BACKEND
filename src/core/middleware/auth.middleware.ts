import type { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { db } from '../db/prisma.js';
import { HttpError } from '../../config/index.js'
import type {AuthRequest, JwtPayload} from '../../config/index.js'
import { JWT_SECRET } from '../../config/index.d.js';
import { userRole } from '@prisma/client';

// Middleware to verify JWT and attach user data
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError('Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new HttpError('Authentication token missing', 401);
    }

    // 1. Verify and Decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 2. Fetch the user from the database
    const user = await db.user.findUnique({
      where: { userId: decoded.userId },
      // Select only necessary/safe fields
      select: { userId: true, email: true, role: true, createdAt: true, business: true },
    });

    if (!user) {
      throw new HttpError('User not found', 401);
    }

    // 3. Attach user object to the request
    req.user = user;
    next();
  } catch (error) {
    // Handle JWT errors (e.g., expired, invalid signature)
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new HttpError('Invalid or expired token', 401));
    }
    next(error); // Pass other errors to the error middleware
  }
};

// Middleware for role-based access control
export const roleMiddleware = (requiredRole: userRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Assuming authMiddleware has run and req.user is populated
    if (!req.user || req.user.role !== requiredRole) {
      return next(new HttpError('Forbidden: Insufficient permissions', 403));
    }
    next();
  };
};