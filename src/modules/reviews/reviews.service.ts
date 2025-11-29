import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';

class ReviewsService {
    public async addReview(userId: string, businessId: string, rating: number, comment?: string) {
        if (rating < 1 || rating > 5) {
            throw new HttpError('Rating must be between 1 and 5', 400);
        }

        // Check if user already reviewed this business
        const existingReview = await db.review.findFirst({
            where: {
                userId,
                businessId,
            },
        });

        if (existingReview) {
            throw new HttpError('You have already reviewed this business', 400);
        }

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
                        email: true,
                        name: true,
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
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reviews;
    }

    public async getMyReviews(userId: string) {
        const reviews = await db.review.findMany({
            where: { userId },
            include: {
                business: {
                    select: {
                        businessId: true,
                        businessName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return reviews;
    }
}

export const reviewsService = new ReviewsService();
