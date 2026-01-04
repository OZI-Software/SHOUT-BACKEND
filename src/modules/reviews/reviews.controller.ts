import type { Response, NextFunction } from 'express';
import { reviewService } from './reviews.service.js';
import { HttpError, type AuthRequest } from '../../config/index.js';

class ReviewsController {
    public createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Unauthorized', 401);
            const { businessId, rating, comment } = req.body;

            if (!businessId || !rating) throw new HttpError('Business ID and rating are required', 400);

            const review = await reviewService.createReview(req.user.userId, {
                businessId,
                rating,
                comment
            });
            res.status(201).json({ status: 'success', data: review });
        } catch (error) {
            next(error);
        }
    }

    public getBusinessReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { businessId } = req.params;
            if (!businessId) throw new HttpError('Business ID is required', 400);
            const reviews = await reviewService.getBusinessReviews(businessId);
            res.status(200).json({ status: 'success', count: reviews.length, data: reviews });
        } catch (error) {
            next(error);
        }
    }
}

export const reviewsController = new ReviewsController();
