import { Router } from 'express';
import { userController } from './users.controller.js';
import { authMiddleware, roleMiddleware } from '../../core/middleware/auth.middleware.js';
import { userRole } from '@prisma/client';

/**
 * Defines the routes for the User module.
 */
class UserRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Get currently authenticated user's profile
    this.router.get('/me', authMiddleware, userController.getMe);
    
    // Get a user by ID (requires ADMIN role for fetching others' profiles)
    this.router.get('/:id', authMiddleware, roleMiddleware(userRole.ADMIN), userController.getUserById);

    // Add more routes: e.g., POST, PUT, DELETE
  }
}

export const userRoutes = new UserRoutes();