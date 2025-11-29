import { Router } from 'express';
import { businessController } from './business.controller.js';
import { authMiddleware, roleMiddleware } from '../../core/middleware/auth.middleware.js';
import type { UserRole } from '@prisma/client';

class BusinessRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public route to find businesses near a location (no auth needed)
    this.router.get('/nearby', businessController.getNearbyBusinesses);

    // Public route to search businesses
    this.router.get('/search', businessController.searchBusinesses);

    // Get and Update current user's business profile (requires ADMIN role)
    this.router.get('/me', authMiddleware, roleMiddleware('ADMIN' as unknown as UserRole), businessController.getMyBusinessProfile);
    this.router.put('/me', authMiddleware, roleMiddleware('ADMIN' as unknown as UserRole), businessController.updateMyBusinessProfile);

    // Offers of a given businessId
    this.router.get('/:id/offers', businessController.getBusinessOffers);
    // Public route to get business by businessId
    this.router.get('/:id', businessController.getBusinessById);
  }
}

export const businessRoutes = new BusinessRoutes();