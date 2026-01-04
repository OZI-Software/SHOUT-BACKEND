import { Router } from 'express';
import { favoritesController } from './favorites.controller.js';
import { authMiddleware as authenticate } from '../../core/middleware/auth.middleware.js';

const router = Router();

// Protected routes
router.use(authenticate);

router.post('/toggle', favoritesController.toggleBusinessFavorite);
router.get('/my', favoritesController.getMyFavorites);

export const favoritesRoutes = router;
