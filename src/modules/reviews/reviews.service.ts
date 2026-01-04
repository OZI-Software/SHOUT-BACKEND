import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';

export interface CreateReviewDto {
    businessId: string;
    rating: number;
    comment: string;
}

class ReviewService {
    public async createReview(userId: string, dto: CreateReviewDto) {
        // user cannot review same business multiple times? 
        // For now, let's allow it or maybe check existence.

        return await db.review.create({
            data: {
                userId,
                businessId: dto.businessId,
                rating: dto.rating,
                comment: dto.comment
            }
        });
    }

    public async getBusinessReviews(businessId: string) {
        return await db.review.findMany({
            where: { businessId },
            include: {
                user: {
                    select: {
                        name: true,
                        // avatar?
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}

export const reviewService = new ReviewService();
