import type { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { HttpError } from '../../config/index.js'

class AuthController {
  // POST /api/v1/auth/register
  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, isBusiness } = req.body;
      
      // Basic validation for core user fields
      if (!email || !password || isBusiness === undefined) {
        throw new HttpError('Email, password, and isBusiness flag are required.', 400);
      }

      // The service layer handles validation for required business fields if isBusiness is true
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

  // POST /api/v1/auth/login (remains the same)
  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new HttpError('Email and password are required.', 400));
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

  // POST /api/v1/auth/password-reset/request
  public requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email) return next(new HttpError('Email is required.', 400));
      await authService.requestPasswordReset(email);
      res.status(200).json({ status: 'success', message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/auth/password-reset/confirm
  public confirmPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) return next(new HttpError('Token and new password are required.', 400));
      await authService.confirmPasswordReset(token, password);
      res.status(200).json({ status: 'success', message: 'Password has been reset successfully.' });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();