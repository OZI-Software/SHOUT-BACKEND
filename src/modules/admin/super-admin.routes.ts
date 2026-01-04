import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import { authMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import { superAdminController } from './super-admin.controller.js';

const router: Router = Router();

// All routes require SUPER_ADMIN role
router.use(authMiddleware);
router.use(rolesMiddleware(['SUPER_ADMIN'] as unknown as UserRole[]));

// Offer analytics
router.get('/offers', superAdminController.getAllOffersWithStats);

// Business management
router.get('/businesses/all', superAdminController.getAllBusinessesDetailed);
router.get('/businesses/:id/detailed', superAdminController.getBusinessDetailed);

// Business onboarding
router.post('/businesses/onboard', superAdminController.onboardBusiness);

// Create admin for business
router.post('/businesses/:id/create-admin', superAdminController.createBusinessAdmin);

export default router;
