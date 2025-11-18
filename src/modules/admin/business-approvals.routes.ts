import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import { businessApprovalsController } from './business-approvals.controller.js';

const router: Router = Router();

// Admin-only routes for managing businesses
router.use(authMiddleware);
router.use(rolesMiddleware([UserRole.ADMIN, UserRole.STAFF]));

router.get('/businesses', businessApprovalsController.listBusinesses);
router.get('/businesses/:id', businessApprovalsController.getBusiness);
router.post('/businesses/:id/approve', businessApprovalsController.approveBusiness);
router.post('/businesses/:id/reject', businessApprovalsController.rejectBusiness);

export default router;