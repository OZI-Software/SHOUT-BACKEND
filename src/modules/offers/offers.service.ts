import { db } from '../../core/db/prisma.js';
import {  OfferStatus } from '@prisma/client';
import type {Offer} from '@prisma/client';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';


interface CreateOfferDto {
  title: string;
  description: string;
  imageUrl: string;
  startDateTime: Date;
  endDateTime: Date;
  status?: OfferStatus;
}

interface UpdateOfferDto {
  title?: string;
  description?: string;
  imageUrl?: string;
  status?: OfferStatus;
  startDateTime?: Date;
  endDateTime?: Date;
}

class OfferService {
  /**
   * Creates a new offer associated with the creatorId (business owner/admin).
   */
  public async createOffer(creatorId: string, dto: CreateOfferDto): Promise<Offer> {
    logger.info(`[Offers] Creating new offer for creatorId: ${creatorId}`);
    logger.debug(`[Offers] Offer data:`, { title: dto.title, status: dto.status || OfferStatus.DRAFT });
    
    try {
      const newOffer = await db.offer.create({
        data: {
          ...dto,
          creatorId,
          status: dto.status || OfferStatus.DRAFT
        },
      });
      
      logger.info(`[Offers] Offer created successfully - offerId: ${newOffer.id}, title: "${newOffer.title}"`);
      return newOffer;
    } catch (error) {
      logger.error(`[Offers] Error creating offer for creatorId: ${creatorId}:`, error);
      throw new HttpError('Failed to create offer', 500);
    }
  }

  /**
   * Finds a single offer by its ID.
   */
  public async findOfferById(id: string): Promise<Offer> {
    logger.debug(`[Offers] Looking up offer by id: ${id}`);
    
    const offer = await db.offer.findUnique({
      where: { id },
      include: { creator: { select: { email: true, role: true } } },
    });
    
    if (!offer) {
      logger.warn(`[Offers] Offer not found for id: ${id}`);
      throw new HttpError('Offer not found', 404);
    }
    
    logger.info(`[Offers] Offer found - id: ${id}, title: "${offer.title}", status: ${offer.status}`);
    return offer;
  }

  /**
   * Reposts an existing offer, creating a new record linked to the original.
   */
  public async repostOffer(originalOfferId: string, creatorId: string): Promise<Offer> {
    logger.info(`[Offers] Reposting offer - originalOfferId: ${originalOfferId}, creatorId: ${creatorId}`);
    
    const originalOffer = await this.findOfferById(originalOfferId);
    logger.debug(`[Offers] Original offer found for repost: "${originalOffer.title}"`);

    // Create a new offer based on the original, but with DRAFT status
    const newOfferData: CreateOfferDto = {
        title: `REPOST: ${originalOffer.title}`,
        description: originalOffer.description,
        imageUrl: originalOffer.imageUrl,
        startDateTime: new Date(), // Set new start/end times
        endDateTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // e.g., 7 days from now
        status: OfferStatus.DRAFT,
    };
    
    logger.debug(`[Offers] Creating repost with title: "${newOfferData.title}"`);
    
    const repostedOffer = await db.offer.create({
        data: {
            ...newOfferData,
            creatorId,
            repostedFromOfferId: originalOfferId,
        }
    });
    
    logger.info(`[Offers] Offer reposted successfully - newOfferId: ${repostedOffer.id}, originalOfferId: ${originalOfferId}`);
    return repostedOffer;
  }


  /**
   * Finds active offers within a certain radius of a given point (Geo-filtering for users).
   */
  public async findNearbyActiveOffers(latitude: number, longitude: number, radiusMeters: number): Promise<Offer[]> {
    logger.info(`[Offers] Finding nearby active offers - lat: ${latitude}, lng: ${longitude}, radius: ${radiusMeters}m`);
    
    // if (!process.env.DATABASE_URL?.includes('postgis')) {
    //     logger.warn('[Offers] PostGIS not detected/configured. Falling back to basic query.');
    //     return [];
    // }

    logger.debug(`[Offers] Using PostGIS for geo-filtering active offers`);

    // // Raw SQL for PostGIS distance calculation and filtering for ACTIVE offers
    // const nearbyOffers = await db.$queryRaw<Offer[]>`
    //   SELECT 
    //     *,
    //     ST_Distance(
    //       ST_MakePoint("targetLongitude", "targetLatitude")::geography, 
    //       ST_MakePoint(${longitude}, ${latitude})::geography
    //     ) as distanceMeters
    //   FROM "Offer"
    //   WHERE "status" = 'ACTIVE' 
    //   AND ST_DWithin(
    //     ST_MakePoint("targetLongitude", "targetLatitude")::geography,
    //     ST_MakePoint(${longitude}, ${latitude})::geography,
    //     ${radiusMeters}
    //   )
    //   ORDER BY distanceMeters
    // `;
    

    const R = 6371000; // Earth radius in meters

    // Join offers with businesses (creatorId -> Business.userId) and filter using business coordinates
    const nearbyOffers = await db.$queryRaw<Offer[]>`
      SELECT 
        o.*,
        (
          ${R} * acos(
            least(1, cos(radians(${latitude}))
            * cos(radians(b."latitude"))
            * cos(radians(b."longitude") - radians(${longitude})) 
            + sin(radians(${latitude})) 
            * sin(radians(b."latitude")))
          )
        ) AS "distanceInMeters"
      FROM "offers" o
      INNER JOIN "businesses" b ON b."userId" = o."creatorId"
      WHERE o."status" = 'ACTIVE'
      AND (
        ${R} * acos(
          least(1, cos(radians(${latitude}))
          * cos(radians(b."latitude"))
          * cos(radians(b."longitude") - radians(${longitude})) 
          + sin(radians(${latitude})) 
          * sin(radians(b."latitude")))
        )
      ) <= ${radiusMeters}
      ORDER BY o."startDateTime" DESC
    `;

    logger.info(`[Offers] Found ${nearbyOffers.length} active offers within ${radiusMeters}m radius`);
    return nearbyOffers;
  }

  /**
   * Updates an existing offer, ensuring the caller is the creator.
   */
  public async updateOffer(offerId: string, creatorId: string, dto: UpdateOfferDto): Promise<Offer> {
    // 1. Check if the offer exists and if the user is the creator
    const offerToUpdate = await db.offer.findUnique({
      where: { id: offerId },
      select: { id: true, creatorId: true, status: true },
    });

    if (!offerToUpdate) {
      throw new HttpError('Offer not found', 404);
    }

    if (offerToUpdate.creatorId !== creatorId) {
      throw new HttpError('Forbidden: You can only update your own offers', 403);
    }

    // 2. Prevent updates if the offer is already expired
    if (offerToUpdate.status === OfferStatus.EXPIRED) {
        throw new HttpError('Cannot update an expired offer', 400);
    }

    // 3. Perform the update
    try {
      const updatedOffer = await db.offer.update({
        where: { id: offerId },
        data: dto,
      });
      return updatedOffer;
    } catch (error) {
      // P2025 is typically "Record to update not found", but we already checked.
      // We'll log and throw a general error for other DB issues.
      logger.error('Error updating offer:', error);
      throw new HttpError('Failed to update offer', 500);
    }
  }

  /**
   * Returns all offers created by the given user (creatorId).
   */
  public async findOffersByCreatorId(creatorId: string): Promise<Offer[]> {
    logger.info(`[Offers] Fetching offers for creatorId: ${creatorId}`);
    try {
      const offers = await db.offer.findMany({
        where: { creatorId },
        orderBy: { createdAt: 'desc' },
      });
      logger.info(`[Offers] Found ${offers.length} offers for creatorId: ${creatorId}`);
      return offers;
    } catch (error) {
      logger.error('[Offers] Error fetching my offers:', error);
      throw new HttpError('Failed to fetch offers', 500);
    }
  }

  /**
   * Deletes an offer ensuring the caller is the creator.
   */
  public async deleteOffer(offerId: string, creatorId: string): Promise<void> {
    const offer = await db.offer.findUnique({
      where: { id: offerId },
      select: { id: true, creatorId: true },
    });
    if (!offer) {
      throw new HttpError('Offer not found', 404);
    }
    if (offer.creatorId !== creatorId) {
      throw new HttpError('Forbidden: You can only delete your own offers', 403);
    }
    await db.offer.delete({ where: { id: offerId } });
  }
}

export const offerService = new OfferService();