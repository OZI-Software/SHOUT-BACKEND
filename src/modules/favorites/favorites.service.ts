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

    /**
     * Toggle favorite status for an offer
     */
    public async toggleFavoriteOffer(userId: string, offerId: string): Promise<{ isFavorited: boolean }> {
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

    /**
     * Get user's favorite offers
     */
    public async getUserFavoriteOffers(userId: string): Promise<any[]> {
        const favorites = await db.favoriteOffer.findMany({
            where: { userId },
            include: {
                offer: {
                    include: {
                        creator: {
                            select: {
                                business: {
                                    select: {
                                        businessId: true,
                                        businessName: true,
                                        address: true,
                                        pinCode: true,
                                        latitude: true,
                                        longitude: true,
                                        openingTime: true,
                                        closingTime: true,
                                        isOpen24Hours: true,
                                        workingDays: true,
                                        category: true,
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return favorites.map(f => {
            const offer = f.offer as any;
            const business = offer.creator?.business;

            return {
                ...offer,
                businessId: business?.businessId,
                businessName: business?.businessName,
                businessAddress: business?.address,
                businessPinCode: business?.pinCode,
                businessLatitude: business?.latitude,
                businessLongitude: business?.longitude,
                businessOpeningTime: business?.openingTime,
                businessClosingTime: business?.closingTime,
                businessIsOpen24Hours: business?.isOpen24Hours,
                businessWorkingDays: business?.workingDays,
                businessCategory: business?.category,
            };
        });
    }
}

export const favoritesService = new FavoritesService();
