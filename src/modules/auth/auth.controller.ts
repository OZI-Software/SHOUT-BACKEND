import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';

class AuthController {
  // POST /api/v1/auth/register
  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Basic validation (more robust validation should be used, e.g., Joi/Zod)
      const { email, password, isBusiness } = req.body;
      if (!email || !password) {
        return next(new Error('Email and password are required.'));
      }

      const token = await authService.register(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Registration successful',
        token,
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/auth/login
  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new Error('Email and password are required.'));
      }

      const token = await authService.login(req.body);

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();