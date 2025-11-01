import { Router } from 'express';
import { offerController } from './offers.controller.js';
import { authMiddleware, roleMiddleware } from '../../core/middleware/auth.middleware.js';
import { userRole } from '@prisma/client';

class OffersRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public route for users to see active offers near them
    this.router.get('/nearby', offerController.getNearbyOffers);
    this.router.get('/:id', offerController.getOfferById);

    // Routes requiring authentication (ADMIN/Business Owner)
    this.router.use(authMiddleware, roleMiddleware(userRole.ADMIN));
    
    // Create new offer
    this.router.post('/', offerController.createOffer);

    // Update existing offer (NEW ROUTE)
    this.router.put('/:id', offerController.updateOffer); // Using PUT for full replacement/update
    
    // Repost an existing offer
    this.router.post('/:id/repost', offerController.repostOffer);

    // TODO: Add PUT/DELETE routes with creatorId check for authorization
  }
}

export const offersRoutes = new OffersRoutes();