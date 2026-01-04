import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { authMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import type { UserRole } from '@prisma/client';

export class AnalyticsRoutes {
    public router: Router = Router();

    constructor() {
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post('/track', (req, res, next) => {
            next();
        }, analyticsController.trackEvent);

        // Super Admin Analytics stats
        this.router.get(
            '/super-admin/offers',
            authMiddleware,
            rolesMiddleware(['SUPER_ADMIN'] as unknown as UserRole[]),
            analyticsController.getOfferAnalytics
        );
    }
}

export const analyticsRoutes = new AnalyticsRoutes();
