import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';
import { randomUUID } from 'crypto';

class OfferAcceptanceService {
    /**
     * Customer accepts an offer. Generates a QR code.
     */
    public async acceptOffer(userId: string, offerId: string) {
        // 1. Check if offer exists and is active
        const offer = await db.offer.findUnique({
            where: { id: offerId },
        });

        if (!offer) {
            throw new HttpError('Offer not found', 404);
        }

        // Check if offer is active
        if ((offer as any).status !== 'ACTIVE') {
            throw new HttpError('Offer is not active', 400);
        }

        const existingAcceptance = await (db as any).offerAcceptance.findFirst({
            where: {
                userId,
                offerId,
                status: {
                    in: ['PENDING', 'REDEEMED']
                }
            }
        });

        if (existingAcceptance) {
            if (existingAcceptance.status === 'PENDING') {
                return existingAcceptance; // Return existing pending acceptance if they lost the QR
            }
            throw new HttpError('You have already accepted and redeemed this offer', 400);
        }

        // 2. Calculate expiration
        // @ts-ignore - Prisma Client might be outdated
        const qrValidityDays = (offer as any).qrValidityDays || 1;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + qrValidityDays);

        // 3. Generate QR Code string (using UUID for uniqueness)
        const qrCode = randomUUID();

        // 4. Create Acceptance Record
        const acceptance = await (db as any).offerAcceptance.create({
            data: {
                userId,
                offerId,
                qrCode,
                expiresAt,
                status: 'PENDING'
            }
        });

        logger.info(`[OfferAcceptance] User ${userId} accepted offer ${offerId}. QR: ${qrCode}`);
        return acceptance;
    }

    /**
     * Business Admin validates a QR code.
     */
    public async validateQr(businessUserId: string, qrCode: string) {
        // 1. Find the acceptance record
        const acceptance = await (db as any).offerAcceptance.findUnique({
            where: { qrCode },
            include: {
                offer: true
            }
        });

        if (!acceptance) {
            throw new HttpError('Invalid QR Code', 404);
        }

        // 2. authorization check: Does this offer belong to the business admin?
        if (acceptance.offer.creatorId !== businessUserId) {
            throw new HttpError('Forbidden: This offer does not belong to your business', 403);
        }

        // 3. Status checks
        if (acceptance.status === 'REDEEMED') {
            throw new HttpError('This QR code has already been redeemed', 400);
        }

        if (acceptance.status === 'EXPIRED') {
            throw new HttpError('This QR code has expired', 400);
        }

        if (acceptance.expiresAt < new Date()) {
            // Update to expired if not already
            await (db as any).offerAcceptance.update({
                where: { id: acceptance.id },
                data: { status: 'EXPIRED' }
            });
            throw new HttpError('This QR code has expired', 400);
        }

        // 4. Redeem
        const redeemed = await (db as any).offerAcceptance.update({
            where: { id: acceptance.id },
            data: {
                status: 'REDEEMED',
                redeemedAt: new Date()
            }
        });

        logger.info(`[OfferAcceptance] QR ${qrCode} redeemed by business ${businessUserId}`);
        return redeemed;
    }

    /**
     * Super Admin gets stats.
     */
    public async getAllAcceptances() {
        return await (db as any).offerAcceptance.findMany({
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        mobileNumber: true
                    }
                },
                offer: {
                    select: {
                        title: true,
                        creator: {
                            select: {
                                business: {
                                    select: {
                                        businessName: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                acceptedAt: 'desc'
            }
        });
    }
}

export const offerAcceptanceService = new OfferAcceptanceService();
