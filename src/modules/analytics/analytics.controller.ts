import type { Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';

class AnalyticsController {

    // POST /api/v1/analytics/track
    // Public or Auth generic
    public trackEvent = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { type, offerId, businessId } = req.body;
            const userId = req.user?.userId; // Optional

            if (!type) {
                throw new HttpError('Event type is required', 400);
            }

            await analyticsService.trackEvent({
                type,
                ...(offerId && { offerId }),
                ...(businessId && { businessId }),
                ...(userId && { userId })
            });

            res.status(200).json({ status: 'success' });
        } catch (error) {
            // Analytics failures shouldn't crash app, but we log in service
            // Return 200 even if failed? Or 400? 
            // Better to return 200 to frontend for non-critical tracking
            res.status(200).json({ status: 'ignored' });
        }
    };

    // GET /api/v1/analytics/super-admin/offers
    // Super Admin Only
    public getOfferAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (req.user?.role !== 'SUPER_ADMIN') {
                throw new HttpError('Forbidden', 403);
            }

            const { period, startDate, endDate } = req.query;

            const data = await analyticsService.getOfferStats({
                period: period as any,
                startDate: startDate as string,
                endDate: endDate as string
            });

            res.status(200).json({ status: 'success', count: data.length, data });
        } catch (error) {
            next(error);
        }
    };
}

export const analyticsController = new AnalyticsController();
