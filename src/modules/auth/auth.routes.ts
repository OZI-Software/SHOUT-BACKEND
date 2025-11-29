import { Router } from 'express';
import { authController } from './auth.controller.js';

class AuthRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post('/send-otp', authController.sendOtp);
    this.router.post('/register', authController.register);
    this.router.post('/login', authController.login);
    this.router.post('/password-reset/request', authController.requestPasswordReset);
    this.router.post('/password-reset/confirm', authController.confirmPasswordReset);
  }
}

export const authRoutes = new AuthRoutes();