import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';
import { reviewsService } from './reviews.service.js';

class ReviewsController {
    public addReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Not authenticated', 401);
            const { businessId } = req.params;
            if (!businessId) throw new HttpError('Business ID is required', 400);
            const { rating, comment } = req.body;

            const review = await reviewsService.addReview(req.user.userId, businessId, rating, comment);
            res.status(201).json({ status: 'success', data: review });
        } catch (error) {
            next(error);
        }
    };

    public getReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { businessId } = req.params;
            if (!businessId) throw new HttpError('Business ID is required', 400);
            const reviews = await reviewsService.getReviews(businessId);
            res.status(200).json({ status: 'success', data: reviews });
        } catch (error) {
            next(error);
        }
    };
}

export const reviewsController = new ReviewsController();
