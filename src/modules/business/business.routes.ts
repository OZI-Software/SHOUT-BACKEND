import { Router } from 'express';
import { businessController } from './business.controller.js';
import { authMiddleware, roleMiddleware } from '../../core/middleware/auth.middleware.js';
import { userRole } from '@prisma/client';

class BusinessRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public route to find businesses near a location (no auth needed)
    this.router.get('/nearby', businessController.getNearbyBusinesses);

    // Get and Update current user's business profile (requires ADMIN role)
    this.router.get('/me', authMiddleware, roleMiddleware(userRole.ADMIN), businessController.getMyBusinessProfile);
    this.router.put('/me', authMiddleware, roleMiddleware(userRole.ADMIN), businessController.updateMyBusinessProfile);
  }
}

export const businessRoutes = new BusinessRoutes();