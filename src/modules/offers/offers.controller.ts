import type { Response, NextFunction } from 'express';
import { offerService } from './offers.service.js';
import { HttpError } from '../../config/index.js';
import type {AuthRequest} from '../../config/index.js';
import { OfferStatus, Prisma } from '@prisma/client';
import { uploadBufferToCloudinary } from '../../core/cloudinary.js';
import { db } from '../../core/db/prisma.js';

class OfferController {
  // POST /api/v1/offers
  public createOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      // Enforce business approval before allowing content creation
      const business = await db.business.findFirst({ where: { userId: req.user.userId } });
      if (!business) throw new HttpError('Business profile not found', 404);
      if (business.status !== ('APPROVED' as Prisma.BusinessStatus)) {
        throw new HttpError('Business is not approved to post content', 403);
      }
      
      // Validation check for mandatory fields
      const { title, description, startDateTime, endDateTime } = req.body;
      if (!title || !description || !startDateTime || !endDateTime) {
          throw new HttpError('Missing required fields', 400);
      }

      const dto: any = {
        title,
        description,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
      };

      // Image handling: either uploaded file or direct link
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file && file.buffer) {
        const result = await uploadBufferToCloudinary(file.buffer, 'shout/offers', file.originalname);
        dto.imageUrl = result.secure_url || result.url;
      } else if (req.body.imageUrl) {
        dto.imageUrl = req.body.imageUrl;
      } else {
        throw new HttpError('Either an image file or imageUrl must be provided', 400);
      }

      // Optional status passthrough if provided and valid
      if (req.body.status && Object.values(OfferStatus).includes(req.body.status)) {
        dto.status = req.body.status;
      }

      const offer = await offerService.createOffer(req.user.userId, dto);

      res.status(201).json({ status: 'success', data: offer });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/offers/:id
  public getOfferById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const offer = await offerService.findOfferWithBusinessById(id as string);
      res.status(200).json({ status: 'success', data: offer });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/offers/:id/repost
  public repostOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new HttpError('Not authenticated', 401);
        const business = await db.business.findFirst({ where: { userId: req.user.userId } });
        if (!business) throw new HttpError('Business profile not found', 404);
        if (business.status !== ('APPROVED' as Prisma.BusinessStatus)) {
          throw new HttpError('Business is not approved to repost content', 403);
        }
        const { id } = req.params;

        const newOffer = await offerService.repostOffer(id as string, req.user.userId);
        
        res.status(201).json({ status: 'success', message: 'Offer successfully reposted as DRAFT', data: newOffer });
    } catch (error) {
        next(error);
    }
  };

  // GET /api/v1/offers/nearby?lat=...&lon=...
  public getNearbyOffers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { lat, lon, radius } = req.query;

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const radiusMeters = parseInt(radius as string, 10) || 10000; // Default to 10km

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new HttpError('Invalid latitude or longitude provided', 400);
      }

      const offers = await offerService.findNearbyActiveOffers(latitude, longitude, radiusMeters);

      res.status(200).json({ status: 'success', count: offers.length, data: offers });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/offers/mine
  public getMyOffers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const creatorId = req.user.userId;
      const offers = await offerService.findOffersByCreatorId(creatorId);
      res.status(200).json({ status: 'success', count: offers.length, data: offers });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/offers/:id
   * Deletes an offer created by the authenticated user.
   */
  public deleteOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const business = await db.business.findFirst({ where: { userId: req.user.userId } });
      if (!business) throw new HttpError('Business profile not found', 404);
      if (business.status !== ('APPROVED' as Prisma.BusinessStatus)) {
        throw new HttpError('Business is not approved to delete content', 403);
      }
      const { id } = req.params;
      await offerService.deleteOffer(id as string, req.user.userId);
      res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/offers/:id
   * Updates an existing offer.
   */
  public updateOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const business = await db.business.findFirst({ where: { userId: req.user.userId } });
      if (!business) throw new HttpError('Business profile not found', 404);
      if (business.status !== ('APPROVED' as Prisma.BusinessStatus)) {
        throw new HttpError('Business is not approved to update content', 403);
      }
      const { id } = req.params;
      const creatorId = req.user.userId;

      // Prepare DTO, converting dates and numbers
      const updateData: any = {};
      
      // Sanitization and type conversion
      if (req.body.startDateTime) updateData.startDateTime = new Date(req.body.startDateTime);
      if (req.body.endDateTime) updateData.endDateTime = new Date(req.body.endDateTime);
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.description) updateData.description = req.body.description;
      // If a new image file is provided, upload and replace imageUrl
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file && file.buffer) {
        const result = await uploadBufferToCloudinary(file.buffer, 'shout/offers', file.originalname);
        updateData.imageUrl = result.secure_url || result.url;
      }
      // Or accept direct link update
      if (req.body.imageUrl) updateData.imageUrl = req.body.imageUrl;
      // Ensure status is a valid enum value if provided
      if (req.body.status && Object.values(OfferStatus).includes(req.body.status)) {
        updateData.status = req.body.status;
      }
      
      // If no valid fields were provided for update
      if (Object.keys(updateData).length === 0) {
        throw new HttpError('No valid fields provided for update', 400);
      }

      const updatedOffer = await offerService.updateOffer(id as string, creatorId, updateData);

      res.status(200).json({ status: 'success', data: updatedOffer });
    } catch (error) {
      next(error);
    }
}
}

export const offerController = new OfferController();