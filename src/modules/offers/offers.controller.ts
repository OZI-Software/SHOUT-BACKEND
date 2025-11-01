import type { Response, NextFunction } from 'express';
import { offerService } from './offers.service.js';
import { HttpError } from '../../config/index.js';
import type {AuthRequest} from '../../config/index.js';
import { OfferStatus } from '@prisma/client';

class OfferController {
  // POST /api/v1/offers
  public createOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      
      // Validation check for mandatory fields (simplified)
      const { title, description, startDateTime, endDateTime } = req.body;
      if (!title || !description || !startDateTime || !endDateTime) {
          throw new HttpError('Missing required fields', 400);
      }

      const offer = await offerService.createOffer(req.user.userId, {
        ...req.body,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
      });

      res.status(201).json({ status: 'success', data: offer });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/offers/:id
  public getOfferById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const offer = await offerService.findOfferById(id as string);
      res.status(200).json({ status: 'success', data: offer });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/offers/:id/repost
  public repostOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) throw new HttpError('Not authenticated', 401);
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
}

export const offerController = new OfferController();