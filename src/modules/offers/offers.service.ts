import { db } from '../../core/db/prisma.js';
import type { OfferStatus, Offer } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

export interface CreateOfferDto {
    title: string;
    description: string;
    imageUrl: string;
    startDateTime: Date;
    endDateTime: Date;
    status?: OfferStatus;
}

export interface UpdateOfferDto {
    title?: string;
    description?: string;
    imageUrl?: string;
    status?: OfferStatus;
    startDateTime?: Date;
    endDateTime?: Date;
}

class OfferService {
    public async createOffer(creatorId: string, dto: CreateOfferDto): Promise<Offer> {
        logger.info(`[Offers] Creating new offer for creatorId: ${creatorId}`);
        try {
            const newOffer = await db.offer.create({
                data: { ...dto, creatorId, status: dto.status || 'DRAFT' },
            });
            logger.info(`[Offers] Offer created - offerId: ${newOffer.id}`);
            return newOffer;
        } catch (error) {
            logger.error(`[Offers] Error creating offer:`, error);
            throw new HttpError('Failed to create offer', 500);
        }
    }

    public async findOfferById(id: string): Promise<any> {
        const offer = await db.offer.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        email: true,
                        role: true,
                        business: {
                            select: {
                                businessId: true,
                                businessName: true,
                                address: true,
                                pinCode: true,
                                latitude: true,
                                longitude: true,
                            }
                        }
                    }
                }
            },
        });

        if (!offer) throw new HttpError('Offer not found', 404);

        const business = offer.creator.business;
        return {
            ...offer,
            businessId: business?.businessId,
            businessName: business?.businessName,
            businessAddress: business?.address,
            businessPinCode: business?.pinCode,
            businessLatitude: business?.latitude,
            businessLongitude: business?.longitude,
        };
    }

    public async repostOffer(originalOfferId: string, creatorId: string): Promise<Offer> {
        const originalOffer = await db.offer.findUnique({ where: { id: originalOfferId } });
        if (!originalOffer) throw new HttpError('Original offer not found', 404);

        const newOfferData: CreateOfferDto = {
            title: `REPOST: ${originalOffer.title}`,
            description: originalOffer.description,
            imageUrl: originalOffer.imageUrl,
            startDateTime: new Date(),
            endDateTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
            status: 'DRAFT',
        };

        return await db.offer.create({
            data: { ...newOfferData, creatorId, repostedFromOfferId: originalOfferId },
        });
    }

    public async findNearbyActiveOffers(latitude: number, longitude: number, radiusMeters: number): Promise<any[]> {
        const R = 6371000; // Earth radius in meters

        // Fetch active offers with their business location data using Prisma relations
        const activeOffers = await db.offer.findMany({
            where: {
                status: 'ACTIVE',
                endDateTime: { gt: new Date() },
            },
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
                            }
                        }
                    }
                }
            },
            orderBy: { startDateTime: 'desc' },
        });

        // Compute Haversine distance for each offer and filter by radius
        const toRadians = (deg: number) => (deg * Math.PI) / 180;
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const dLat = toRadians(lat2 - lat1);
            const dLon = toRadians(lon2 - lon1);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const nearbyOffers = activeOffers
            .map((offer) => {
                const business = offer.creator.business;
                const hasCoords = typeof business?.latitude === 'number' && typeof business?.longitude === 'number';
                const distanceInMeters = hasCoords
                    ? haversine(latitude, longitude, business!.latitude, business!.longitude)
                    : undefined;
                return {
                    ...offer,
                    businessId: business?.businessId,
                    businessName: business?.businessName,
                    businessAddress: business?.address,
                    businessPinCode: business?.pinCode,
                    businessLatitude: business?.latitude,
                    businessLongitude: business?.longitude,
                    // Optional fields omitted due to DB column mismatch
                    distanceInMeters,
                };
            })
            .filter((offer) => offer.distanceInMeters !== undefined && offer.distanceInMeters <= radiusMeters);

        return nearbyOffers;
    }

    public async updateOffer(offerId: string, creatorId: string, dto: UpdateOfferDto): Promise<Offer> {
        const offerToUpdate = await db.offer.findUnique({
            where: { id: offerId },
            select: { id: true, creatorId: true, status: true },
        });

        if (!offerToUpdate) throw new HttpError('Offer not found', 404);
        if (offerToUpdate.creatorId !== creatorId) {
            throw new HttpError('Forbidden: You can only update your own offers', 403);
        }
        if (offerToUpdate.status === 'EXPIRED') {
            throw new HttpError('Cannot update an expired offer', 400);
        }

        try {
            return await db.offer.update({ where: { id: offerId }, data: dto });
        } catch (error) {
            logger.error('Error updating offer:', error);
            throw new HttpError('Failed to update offer', 500);
        }
    }

    public async findOffersByCreatorId(creatorId: string): Promise<Offer[]> {
        try {
            return await db.offer.findMany({
                where: { creatorId },
                orderBy: { createdAt: 'desc' },
            });
        } catch (error) {
            logger.error('[Offers] Error fetching offers:', error);
            throw new HttpError('Failed to fetch offers', 500);
        }
    }

    public async deleteOffer(offerId: string, creatorId: string): Promise<void> {
        const offer = await db.offer.findUnique({
            where: { id: offerId },
            select: { id: true, creatorId: true },
        });
        if (!offer) throw new HttpError('Offer not found', 404);
        if (offer.creatorId !== creatorId) {
            throw new HttpError('Forbidden: You can only delete your own offers', 403);
        }
        await db.offer.delete({ where: { id: offerId } });
    }
}

export const offerService = new OfferService();
