import type { Response, NextFunction } from 'express';
import { favoritesService } from './favorites.service.js';
import { HttpError, type AuthRequest } from '../../config/index.js';

class FavoritesController {
    public toggleBusinessFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Unauthorized', 401);
            const { businessId } = req.body;

            if (!businessId) throw new HttpError('Business ID is required', 400);

            const result = await favoritesService.toggleFavoriteBusiness(req.user.userId, businessId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    };

    public getMyFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Unauthorized', 401);
            const favorites = await favoritesService.getUserFavorites(req.user.userId);
            res.status(200).json({ status: 'success', data: favorites });
        } catch (error) {
            next(error);
        }
    };

    public toggleOfferFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Unauthorized', 401);
            const { offerId } = req.params;

            if (!offerId) throw new HttpError('Offer ID is required', 400);

            const result = await favoritesService.toggleFavoriteOffer(req.user.userId, offerId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    };

    public getMyFavoriteOffers = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Unauthorized', 401);
            const favorites = await favoritesService.getUserFavoriteOffers(req.user.userId);
            res.status(200).json({ status: 'success', data: favorites });
        } catch (error) {
            next(error);
        }
    };
}

export const favoritesController = new FavoritesController();
