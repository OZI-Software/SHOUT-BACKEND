import { db } from '../../core/db/prisma.js';
import type { Business } from '../../../generated/prisma/client.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

interface BusinessUpdateDto {
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
}

class BusinessService {
  /**
   * Finds the business profile associated with a given user ID.
   */
  public async findBusinessByUserId(userId: string): Promise<Business> {
    const business = await db.business.findUnique({
      where: { userId },
    });

    if (!business) {
      throw new HttpError('Business profile not found for this user', 404);
    }
    return business;
  }

  /**
   * Updates an existing business profile.
   */
  public async updateBusiness(userId: string, dto: BusinessUpdateDto): Promise<Business> {
    try {
      const updatedBusiness = await db.business.update({
        where: { userId },
        data: dto,
      });
      return updatedBusiness;
    } catch (error) {
      // Prisma error for unique constraint violation or record not found
      if ((error as any).code === 'P2025') {
        throw new HttpError('Business profile not found', 404);
      }
      logger.error('Error updating business profile:', error);
      throw new HttpError('Failed to update business profile', 500);
    }
  }

  /**
   * Finds businesses within a certain radius of a given point (Geo-filtering).
   * NOTE: This requires the manual PostGIS indices you defined in the schema.
   */
  public async findNearbyBusinesses(latitude: number, longitude: number, radiusMeters: number): Promise<Business[]> {
    if (!process.env.DATABASE_URL?.includes('postgis')) {
        logger.warn('PostGIS not detected/configured. Falling back to basic query.');
        // Fallback or throw error if Geo-filtering is mandatory
        return [];
    }
    
    // Raw SQL for PostGIS distance calculation and filtering
    // ST_DWithin checks if two geometries are within a specified distance
    const nearbyBusinesses = await db.$queryRaw<Business[]>`
      SELECT 
        *,
        ST_Distance(
          ST_MakePoint(longitude, latitude)::geography, 
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) as distanceMeters
      FROM "businesses"
      WHERE ST_DWithin(
        ST_MakePoint(longitude, latitude)::geography,
        ST_MakePoint(${longitude}, ${latitude})::geography,
        ${radiusMeters}
      )
      ORDER BY distanceMeters
    `;
    
    return nearbyBusinesses;
  }
}

export const businessService = new BusinessService();