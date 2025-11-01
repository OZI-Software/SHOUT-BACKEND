import { Router } from 'express';
import { authController } from './auth.controller.js';

class AuthRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post('/register', authController.register);
    this.router.post('/login', authController.login);
  }
}

export const authRoutes = new AuthRoutes();