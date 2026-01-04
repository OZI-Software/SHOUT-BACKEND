import { Router } from 'express';
import { favoritesController } from './favorites.controller.js';
import { authMiddleware as authenticate } from '../../core/middleware/auth.middleware.js';

const router = Router();

// Protected routes
router.use(authenticate);

// Business Favorites
router.post('/toggle-business', favoritesController.toggleBusinessFavorite);
router.get('/my-businesses', favoritesController.getMyFavorites);

// Offer Favorites - Matches client-api.ts endpoints
router.get('/', favoritesController.getMyFavoriteOffers);
router.post('/:offerId', favoritesController.toggleOfferFavorite);

export const favoritesRoutes = router;
