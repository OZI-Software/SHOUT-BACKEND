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
  openingTime?: string;
  closingTime?: string;
  workingDays?: string;
  isOpen24Hours?: boolean;
  abn?: string;
  category?: string;
  images?: string[];
}

// Returned shape includes business-hours fields
type BusinessSafe = Business;

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
        abcCode: true,
        openingTime: true,
        closingTime: true,
        workingDays: true,
        isOpen24Hours: true,
        abn: true,
        category: true,
        images: true,
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
          abcCode: true,
          openingTime: true,
          closingTime: true,
          workingDays: true,
          isOpen24Hours: true,
          abn: true,
          category: true,
          images: true,
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
        abcCode: true,
        openingTime: true,
        closingTime: true,
        workingDays: true,
        isOpen24Hours: true,
        abn: true,
        category: true,
        images: true,
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

  /**
   * Search businesses by name or description
   */
  public async searchBusinesses(query: string): Promise<BusinessSafe[]> {
    logger.info(`[Business] Searching businesses with query: ${query}`);

    const businesses = await db.business.findMany({
      where: {
        OR: [
          { businessName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
        status: 'APPROVED'
      },
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
        abcCode: true,
        openingTime: true,
        closingTime: true,
        workingDays: true,
        isOpen24Hours: true,
        abn: true,
        category: true,
        images: true,
      },
      take: 20
    });

    return businesses;
  }

  /**
   * Get all unique business categories
   */
  public async getCategories(): Promise<string[]> {
    const categories = await db.business.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } }
    });
    return categories.map(c => c.category!).filter(Boolean);
  }
}

export const businessService = new BusinessService();