import { Router } from 'express';
import { reviewsController } from './reviews.controller.js';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';

const router = Router();

// Publicly viewable reviews? Yes, "when profile is viisted to public users"
router.get('/:businessId', reviewsController.getReviews);

// Add review requires auth
router.post('/:businessId', authMiddleware, reviewsController.addReview);

export const reviewsRoutes = router;
