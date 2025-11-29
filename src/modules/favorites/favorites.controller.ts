import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';
import { favoritesService } from './favorites.service.js';

class FavoritesController {
    public toggleFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Not authenticated', 401);
            const { offerId } = req.params;
            if (!offerId) throw new HttpError('Offer ID is required', 400);
            const result = await favoritesService.toggleFavorite(req.user.userId, offerId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    };

    public getFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Not authenticated', 401);
            const favorites = await favoritesService.getFavorites(req.user.userId);
            res.status(200).json({ status: 'success', data: favorites });
        } catch (error) {
            next(error);
        }
    };
}

export const favoritesController = new FavoritesController();
