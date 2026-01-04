import { Router } from 'express';
import { userController } from './users.controller.js';
import { authMiddleware, roleMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import type { UserRole } from "@prisma/client";

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
    this.router.get('/:id', authMiddleware, roleMiddleware('ADMIN' as unknown as UserRole), userController.getUserById);

    // Get all users (requires ADMIN or SUPER_ADMIN role)
    // Updated to allow SUPER_ADMIN to see the list
    this.router.get('/', authMiddleware, rolesMiddleware(['ADMIN', 'SUPER_ADMIN'] as unknown as UserRole[]), userController.getAllUsers);

    // Add more routes: e.g., POST, PUT, DELETE
  }
}

export const userRoutes = new UserRoutes();