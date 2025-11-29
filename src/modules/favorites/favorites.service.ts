import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

class FavoritesService {
    public async toggleFavorite(userId: string, offerId: string): Promise<{ isFavorited: boolean }> {
        const existing = await db.favoriteOffer.findUnique({
            where: {
                userId_offerId: {
                    userId,
                    offerId,
                },
            },
        });

        if (existing) {
            await db.favoriteOffer.delete({
                where: {
                    userId_offerId: {
                        userId,
                        offerId,
                    },
                },
            });
            return { isFavorited: false };
        } else {
            await db.favoriteOffer.create({
                data: {
                    userId,
                    offerId,
                },
            });
            return { isFavorited: true };
        }
    }

    public async getFavorites(userId: string) {
        const favorites = await db.favoriteOffer.findMany({
            where: { userId },
            include: {
                offer: {
                    include: {
                        creator: {
                            select: {
                                business: {
                                    select: {
                                        businessName: true,
                                        address: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return favorites.map(f => ({
            ...f.offer,
            isExpired: f.offer.endDateTime < new Date(),
            businessName: f.offer.creator.business?.businessName,
            businessAddress: f.offer.creator.business?.address,
        }));
    }
}

export const favoritesService = new FavoritesService();
