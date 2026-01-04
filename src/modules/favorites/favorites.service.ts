import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

class FavoritesService {
    /**
     * Toggle favorite status for a business
     */
    public async toggleFavoriteBusiness(userId: string, businessId: string): Promise<{ isFavorited: boolean }> {
        const existing = await db.favoriteBusiness.findUnique({
            where: {
                userId_businessId: {
                    userId,
                    businessId,
                },
            },
        });

        if (existing) {
            await db.favoriteBusiness.delete({
                where: {
                    userId_businessId: {
                        userId,
                        businessId,
                    },
                },
            });
            return { isFavorited: false };
        } else {
            await db.favoriteBusiness.create({
                data: {
                    userId,
                    businessId,
                },
            });
            return { isFavorited: true };
        }
    }

    /**
     * Get user's favorite businesses
     */
    public async getUserFavorites(userId: string): Promise<any[]> {
        const favorites = await db.favoriteBusiness.findMany({
            where: { userId },
            include: {
                business: {
                    select: {
                        businessId: true,
                        businessName: true,
                        description: true,
                        address: true,
                        images: true,
                        category: true,

                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // TODO: Calculate average rating for each business if needed
        return favorites.map(f => f.business);
    }
}

export const favoritesService = new FavoritesService();
