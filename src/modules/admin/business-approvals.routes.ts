import { Router } from 'express';
import { authMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';
import { businessApprovalsController } from './business-approvals.controller.js';

const router = Router();

// Admin-only routes for managing businesses
router.use(authMiddleware);
router.use(rolesMiddleware([UserRole.ADMIN, UserRole.STAFF]));

router.get('/businesses', businessApprovalsController.listBusinesses);
router.get('/businesses/:id', businessApprovalsController.getBusiness);
router.post('/businesses/:id/approve', businessApprovalsController.approveBusiness);
router.post('/businesses/:id/reject', businessApprovalsController.rejectBusiness);

export default router;