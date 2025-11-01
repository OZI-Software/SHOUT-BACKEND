import { db } from '../../core/db/prisma.js';
import {  OfferStatus } from '../../../generated/prisma/client.js'
import type {Offer} from '../../../generated/prisma/client.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';


interface CreateOfferDto {
  title: string;
  description: string;
  imageUrl: string;
  startDateTime: Date;
  endDateTime: Date;
  targetLatitude: number;
  targetLongitude: number;
  targetRadiusMeters: number;
  status?: OfferStatus;
}

class OfferService {
  /**
   * Creates a new offer associated with the creatorId (business owner/admin).
   */
  public async createOffer(creatorId: string, dto: CreateOfferDto): Promise<Offer> {
    try {
      const newOffer = await db.offer.create({
        data: {
          ...dto,
          creatorId,
          status: dto.status || OfferStatus.DRAFT,
        },
      });
      return newOffer;
    } catch (error) {
      logger.error('Error creating offer:', error);
      throw new HttpError('Failed to create offer', 500);
    }
  }

  /**
   * Finds a single offer by its ID.
   */
  public async findOfferById(id: string): Promise<Offer> {
    const offer = await db.offer.findUnique({
      where: { id },
      include: { creator: { select: { email: true, role: true } } },
    });
    if (!offer) {
      throw new HttpError('Offer not found', 404);
    }
    return offer;
  }

  /**
   * Reposts an existing offer, creating a new record linked to the original.
   */
  public async repostOffer(originalOfferId: string, creatorId: string): Promise<Offer> {
    const originalOffer = await this.findOfferById(originalOfferId);

    // Create a new offer based on the original, but with DRAFT status
    const newOfferData: CreateOfferDto = {
        title: `REPOST: ${originalOffer.title}`,
        description: originalOffer.description,
        imageUrl: originalOffer.imageUrl,
        startDateTime: new Date(), // Set new start/end times
        endDateTime: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // e.g., 7 days from now
        targetLatitude: originalOffer.targetLatitude,
        targetLongitude: originalOffer.targetLongitude,
        targetRadiusMeters: originalOffer.targetRadiusMeters,
        status: OfferStatus.DRAFT,
    };
    
    return db.offer.create({
        data: {
            ...newOfferData,
            creatorId,
            repostedFromOfferId: originalOfferId,
        }
    });
  }


  /**
   * Finds active offers within a certain radius of a given point (Geo-filtering for users).
   */
  public async findNearbyActiveOffers(latitude: number, longitude: number, radiusMeters: number): Promise<Offer[]> {
    if (!process.env.DATABASE_URL?.includes('postgis')) {
        logger.warn('PostGIS not detected/configured. Falling back to basic query.');
        return [];
    }

    // Raw SQL for PostGIS distance calculation and filtering for ACTIVE offers
    const nearbyOffers = await db.$queryRaw<Offer[]>`
      SELECT 
        *,
        ST_Distance(
          ST_MakePoint("targetLongitude", "targetLatitude")::geography, 
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) as distanceMeters
      FROM "Offer"
      WHERE "status" = 'ACTIVE' 
      AND ST_DWithin(
        ST_MakePoint("targetLongitude", "targetLatitude")::geography,
        ST_MakePoint(${longitude}, ${latitude})::geography,
        ${radiusMeters}
      )
      ORDER BY distanceMeters
    `;
    
    return nearbyOffers;
  }
}

export const offerService = new OfferService();