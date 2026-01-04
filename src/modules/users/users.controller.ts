import type { Response, NextFunction } from 'express';
import { userService } from './users.service.js';
import { HttpError } from '../../config/index.js'
import type { AuthRequest } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

/**
 * Handles incoming HTTP requests and delegates to the service layer.
 */
class UserController {
  // GET /api/v1/users/me
  public getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.user is populated by authMiddleware
      if (!req.user) {
        throw new HttpError('User not authenticated', 401);
      }

      // Fetch the full user details using the service layer
      const user = await userService.findUserById(req.user.userId);

      res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/users/:id
  public getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userService.findUserById(id as string);

      res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/users/
  public getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await userService.findAll();
      res.status(200).json({
        status: 'success',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();