import type { Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

class AnalyticsController {

    // POST /api/v1/analytics/track
    // Public or Auth generic
    public trackEvent = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { type, offerId, businessId } = req.body;
            const userId = req.user?.userId; // Optional

            logger.info(`[Analytics Controller] Received track request: ${JSON.stringify(req.body)}`);

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
            logger.error('[Analytics Controller] Failed to track event:', error);
            // Still return 200 to client to avoid disrupting UX, but log error on server
            res.status(200).json({ status: 'error', message: 'Tracking failed internally but handled gracefully' });
        }
    };

    // GET /api/v1/analytics/super-admin/offers
    // Super Admin Only
    public getOfferAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (req.user?.role !== 'SUPER_ADMIN') {
                throw new HttpError('Forbidden', 403);
            }

            const { period, startDate, endDate, businessId } = req.query;

            const result = await analyticsService.getOfferStats({
                period: period as any,
                startDate: startDate as string,
                endDate: endDate as string,
                businessId: businessId as string
            });

            res.status(200).json({
                status: 'success',
                data: {
                    items: result.items,
                    totals: result.totals
                }
            });
        } catch (error) {
            next(error);
        }
    };
}

export const analyticsController = new AnalyticsController();
