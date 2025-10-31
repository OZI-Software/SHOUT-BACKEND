import type { Request, Response, NextFunction } from 'express';
import  { AuthService } from './auth.service.js';
import logger  from '../../core/utils/logger.js';
import type { IAuthRequest } from '../../core/types/index.d.js';
// import { userRole } from '../../../generated/prisma/index.js';

/**
 * AuthenticationController manages the API endpoints for user identity.
 * It strictly handles request/response and delegates business logic to AuthService.
 */
export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * [POST /api/auth/register] Registers a new staff member.
   */
  registerStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, password, businessId } = req.body;
      
      if (!name || !email || !password || !businessId) {
         return next({ statusCode: 400, message: 'Missing required registration fields.' });
      }
      // if (!Object.values(UserRole).includes(role)) {
      //     return next({ statusCode: 400, message: 'Invalid user role specified.' });
      // }

      const user = await this.authService.registerStaff(name, email, password, businessId);
      
      res.status(201).json({ message: 'User created successfully.', userId: user.id });
    } catch (error) {
      // Delegate to error middleware
      next(error);
    }
  };

  /**
   * [POST /api/auth/login] Logs in a user and returns a JWT.
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return next({ statusCode: 400, message: 'Email and password are required.' });
      }

      const result = await this.authService.login(email, password);
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * [POST /api/auth/fcm-token] Saves the user's FCM token for push notifications.
   * Requires authentication (authMiddleware).
   */
  saveFCMToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as IAuthRequest;
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return next({ statusCode: 400, message: 'FCM token is required.' });
      }

      // Business logic handled by the service
      await this.authService.saveFCMToken(authReq.userId, fcmToken);

      res.status(200).json({ message: 'FCM token saved successfully.' });
    } catch (error) {
      next(error);
    }
  };
}