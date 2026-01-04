import { Router } from 'express';
import { reviewsController } from './reviews.controller.js';
import { authMiddleware as authenticate } from '../../core/middleware/auth.middleware.js';

const router = Router();

// Public routes
router.get('/:businessId', reviewsController.getBusinessReviews);

// Protected routes
router.post('/', authenticate, reviewsController.createReview);

export const reviewsRoutes = router;
