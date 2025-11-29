import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';

class ReviewsService {
    public async addReview(userId: string, businessId: string, rating: number, comment?: string) {
        if (rating < 1 || rating > 5) {
            throw new HttpError('Rating must be between 1 and 5', 400);
        }

        // Check if user already reviewed this business? 
        // Usually one review per user per business is a good rule, but user didn't specify.
        // I'll allow multiple for now or maybe upsert?
        // Let's just create a new one.

        const review = await db.review.create({
            data: {
                userId,
                businessId,
                rating,
                comment: comment ?? null,
            },
            include: {
                user: {
                    select: {
                        userId: true,
                        email: true, // Maybe show name if we had it, but email is all we have
                    },
                },
            },
        });

        return review;
    }

    public async getReviews(businessId: string) {
        const reviews = await db.review.findMany({
            where: { businessId },
            include: {
                user: {
                    select: {
                        userId: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reviews;
    }
}

export const reviewsService = new ReviewsService();
