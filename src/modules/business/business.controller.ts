import type { Response, NextFunction } from 'express';
import { businessService } from './business.service.js';
import { HttpError} from '../../config/index.js';
import type {AuthRequest } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

class BusinessController {
  // GET /api/v1/business/me
  public getMyBusinessProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);

      const business = await businessService.findBusinessByUserId(req.user.userId);

      res.status(200).json({ status: 'success', data: business });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/v1/business/me
  public updateMyBusinessProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      
      // Ensure only Business owners (ADMIN role) can update their profile
      if (req.user.role !== 'ADMIN') {
        throw new HttpError('Forbidden: Only business owners can update their profile', 403);
      }

      const updatedBusiness = await businessService.updateBusiness(req.user.userId, req.body);

      res.status(200).json({ status: 'success', data: updatedBusiness });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/business/nearby?lat=...&lon=...&radius=...
  public getNearbyBusinesses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { lat, lon, radius } = req.query;

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const radiusMeters = parseInt(radius as string, 10) || 5000; // Default to 5km

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new HttpError('Invalid latitude or longitude provided', 400);
      }

      const businesses = await businessService.findNearbyBusinesses(latitude, longitude, radiusMeters);

      res.status(200).json({ status: 'success', count: businesses.length, data: businesses });
    } catch (error) {
      next(error);
    }
  };
}

export const businessController = new BusinessController();