import { db } from '../../core/db/prisma.js';
import type { Business } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

interface BusinessUpdateDto {
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
}

// Returned shape omits business-hours fields that are not present in DB columns
type BusinessSafe = Omit<Business, 'openingTime' | 'closingTime' | 'workingDays' | 'isOpen24Hours'>;

class BusinessService {
  /**
   * Finds the business profile associated with a given user ID.
   */
  public async findBusinessByUserId(userId: string): Promise<BusinessSafe> {
    logger.debug(`[Business] Looking up business profile for userId: ${userId}`);
    
    const business = await db.business.findUnique({
      where: { userId },
      select: {
        businessId: true,
        userId: true,
        businessName: true,
        description: true,
        address: true,
        pinCode: true,
        googleMapsLink: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        status: true,
        approvedAt: true,
        approvedBy: true,
        reviewNote: true,
      },
    });

    if (!business) {
      logger.warn(`[Business] Business profile not found for userId: ${userId}`);
      throw new HttpError('Business profile not found for this user', 404);
    }
    
    logger.info(`[Business] Business profile found for userId: ${userId}, businessId: ${business.businessId}`);
    return business;
  }

  /**
   * Updates an existing business profile.
   */
  public async updateBusiness(userId: string, dto: BusinessUpdateDto): Promise<BusinessSafe> {
    logger.info(`[Business] Updating business profile for userId: ${userId}`);
    logger.debug(`[Business] Update data:`, dto);
    
    try {
      const updatedBusiness = await db.business.update({
        where: { userId },
        data: dto,
        select: {
          businessId: true,
          userId: true,
          businessName: true,
          description: true,
          address: true,
          pinCode: true,
          googleMapsLink: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          status: true,
          approvedAt: true,
          approvedBy: true,
          reviewNote: true,
        },
      });
      
      logger.info(`[Business] Business profile updated successfully for userId: ${userId}, businessId: ${updatedBusiness.businessId}`);
      return updatedBusiness;
    } catch (error) {
      // Prisma error for unique constraint violation or record not found
      if ((error as any).code === 'P2025') {
        logger.warn(`[Business] Business profile not found for update - userId: ${userId}`);
        throw new HttpError('Business profile not found', 404);
      }
      logger.error(`[Business] Error updating business profile for userId: ${userId}:`, error);
      throw new HttpError('Failed to update business profile', 500);
    }
  }

  /**
   * Find business profile by businessId.
   */
  public async findBusinessByBusinessId(businessId: string): Promise<BusinessSafe> {
    logger.info(`[Business] Fetching business by businessId: ${businessId}`)
    const biz = await db.business.findUnique({
      where: { businessId },
      select: {
        businessId: true,
        userId: true,
        businessName: true,
        description: true,
        address: true,
        pinCode: true,
        googleMapsLink: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        status: true,
        approvedAt: true,
        approvedBy: true,
        reviewNote: true,
      },
    })
    if (!biz) {
      throw new HttpError('Business not found', 404)
    }
    return biz
  }

  /**
   * Finds businesses within a certain radius of a given point (Geo-filtering).
   * NOTE: This requires the manual PostGIS indices you defined in the schema.
   */
  public async findNearbyBusinesses(latitude: number, longitude: number, radiusMeters: number): Promise<Business[]> {
    logger.info(`[Business] Finding nearby businesses - lat: ${latitude}, lng: ${longitude}, radius: ${radiusMeters}m`);
    
    // if (!process.env.DATABASE_URL?.includes('postgis')) {
    //     logger.warn('[Business] PostGIS not detected/configured. Falling back to basic query.');
    //     // Fallback or throw error if Geo-filtering is mandatory
    //     return [];
    // }
    
    // logger.debug(`[Business] Using PostGIS for geo-filtering query`);
    
    // // Raw SQL for PostGIS distance calculation and filtering
    // // ST_DWithin checks if two geometries are within a specified distance
    // const nearbyBusinesses = await db.$queryRaw<Business[]>`
    //   SELECT 
    //     *,
    //     ST_Distance(
    //       ST_MakePoint(longitude, latitude)::geography, 
    //       ST_MakePoint(${longitude}, ${latitude})::geography
    //     ) as distanceMeters
    //   FROM "businesses"
    //   WHERE ST_DWithin(
    //     ST_MakePoint(longitude, latitude)::geography,
    //     ST_MakePoint(${longitude}, ${latitude})::geography,
    //     ${radiusMeters}
    //   )
    //   ORDER BY distanceMeters
    // `;
    
    // Fallback SQL-based calculation using Haversine for distance

const R = 6371000; // Earth radius in meters

const nearbyBusinesses = await db.$queryRaw<Business[]>`
  SELECT
    *,
    (
      ${R} * acos(
        least(1, cos(radians(${latitude}))
        * cos(radians(latitude))
        * cos(radians(longitude) - radians(${longitude}))
        + sin(radians(${latitude}))
        * sin(radians(latitude)))
      )
    ) AS distanceMeters
  FROM "businesses"
  WHERE (
    ${R} * acos(
      least(1, cos(radians(${latitude}))
      * cos(radians(latitude))
      * cos(radians(longitude) - radians(${longitude}))
      + sin(radians(${latitude}))
      * sin(radians(latitude)))
    )
  ) <= ${radiusMeters}
  ORDER BY distanceMeters
`;

    logger.info(`[Business] Found ${nearbyBusinesses.length} businesses within ${radiusMeters}m radius`);
    return nearbyBusinesses;
  }
}

export const businessService = new BusinessService();