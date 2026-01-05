import { Router } from 'express';
import { offerController } from './offers.controller.js';
import { authMiddleware, roleMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import type { UserRole } from '@prisma/client';
import { imageUpload } from '../../core/upload.js';

class OffersRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Public route for users to see active offers near them
    this.router.get('/nearby', offerController.getNearbyOffers);

    // Public route to search offers
    this.router.get('/search', offerController.searchOffers);

    // Authenticated route: Get offers created by current user
    // Place BEFORE the dynamic ":id" route to avoid shadowing
    this.router.get(
      '/mine',
      authMiddleware,
      rolesMiddleware(['ADMIN', 'STAFF'] as unknown as UserRole[]),
      offerController.getMyOffers
    );

    // Customer Acceptance List (Requires Auth)
    this.router.get(
      '/my-acceptances',
      authMiddleware,
      offerController.getMyAcceptances
    );

    // Public route to fetch a specific offer by id (must come AFTER '/mine')
    this.router.get('/:id', offerController.getOfferById);

    // Customer Accept Offer (requires auth but NOT role restriction)
    // MUST come BEFORE role-restricted middleware
    this.router.post(
      '/:id/accept',
      authMiddleware,
      offerController.acceptOffer
    );

    // Apply role restrictions for business admin routes below
    this.router.use(authMiddleware, rolesMiddleware(['ADMIN', 'STAFF'] as unknown as UserRole[]));
    // Accept either an uploaded image file or a direct imageUrl
    this.router.post('/', imageUpload.single('file'), offerController.createOffer);

    // Update existing offer (NEW ROUTE)
    // Allow optional image replacement via file upload
    this.router.put('/:id', imageUpload.single('file'), offerController.updateOffer); // Using PUT for full replacement/update

    // Repost an existing offer
    this.router.post('/:id/repost', offerController.repostOffer);

    // Delete an offer created by current user
    this.router.delete('/:id', offerController.deleteOffer);

    // TODO: Add PUT/DELETE routes with creatorId check for authorization

    // -- Offer Acceptance Routes --

    // Super Admin Stats (Must come before :id routes)
    this.router.get(
      '/stats/acceptances',
      authMiddleware,
      rolesMiddleware(['SUPER_ADMIN'] as unknown as UserRole[]),
      offerController.getAllAcceptances
    );

    // Business Admin Validate QR (Must come before :id routes)
    this.router.post(
      '/validate-qr',
      authMiddleware,
      rolesMiddleware(['ADMIN', 'STAFF'] as unknown as UserRole[]),
      offerController.validateQr
    );

    // Business Admin Preview QR (Must come before :id routes)
    this.router.get(
      '/qr/:code',
      authMiddleware,
      rolesMiddleware(['ADMIN', 'STAFF'] as unknown as UserRole[]),
      offerController.getAcceptanceByQr
    );
  }
}

export const offersRoutes = new OffersRoutes();