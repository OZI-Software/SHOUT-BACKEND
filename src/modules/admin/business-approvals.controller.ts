import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';
import { db } from '../../core/db/prisma.js';
import { logger } from '../../core/utils/logger.js';
import { Prisma } from '@prisma/client';

class BusinessApprovalsController {
  // GET /api/v1/admin/businesses?status=PENDING
  public listBusinesses = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const statusParam = ((req.query.status as string) || 'PENDING').toUpperCase();
      const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
      if (!allowedStatuses.includes(statusParam as typeof allowedStatuses[number])) {
        throw new HttpError('Invalid status filter', 400);
      }
      const businesses = await db.business.findMany({
        where: { status: statusParam as Prisma.BusinessStatus },
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json({ status: 'success', count: businesses.length, data: businesses });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v1/admin/businesses/:id
  public getBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const business = await db.business.findUnique({ where: { businessId: id as string } });
      if (!business) throw new HttpError('Business not found', 404);
      res.status(200).json({ status: 'success', data: business });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/admin/businesses/:id/approve
  public approveBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const { id } = req.params;
      const reviewNote = (req.body?.reviewNote as string) || undefined;
      const updated = await db.business.update({
        where: { businessId: id as string },
        data: {
          status: 'APPROVED' as Prisma.BusinessStatus,
          approvedAt: new Date(),
          approvedBy: req.user.userId,
          reviewNote,
        },
      });
      logger.info(`[Admin] Approved business ${id} by ${req.user.userId}`);
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v1/admin/businesses/:id/reject
  public rejectBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const { id } = req.params;
      const reviewNote = (req.body?.reviewNote as string) || undefined;
      const updated = await db.business.update({
        where: { businessId: id as string },
        data: {
          status: 'REJECTED' as Prisma.BusinessStatus,
          approvedAt: null,
          approvedBy: req.user.userId,
          reviewNote,
        },
      });
      logger.info(`[Admin] Rejected business ${id} by ${req.user.userId}`);
      res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      next(error);
    }
  };
}

export const businessApprovalsController = new BusinessApprovalsController();