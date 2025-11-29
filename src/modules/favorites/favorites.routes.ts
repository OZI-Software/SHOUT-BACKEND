import { Router } from 'express';
import { favoritesController } from './favorites.controller.js';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';

const router = Router();

router.post('/:offerId', authMiddleware, favoritesController.toggleFavorite);
router.get('/', authMiddleware, favoritesController.getFavorites);

export const favoritesRoutes = router;
