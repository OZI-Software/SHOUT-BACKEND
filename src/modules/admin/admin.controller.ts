import type { Request, Response, NextFunction } from 'express';
import { db } from '../../core/db/prisma.js';
import { HttpError } from '../../config/index.js';

class AdminController {
    public getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const [
                totalBusinesses,
                pendingBusinesses,
                approvedBusinesses,
                rejectedBusinesses,
                totalOffers,
                totalUsers
            ] = await Promise.all([
                db.user.count({ where: { role: 'ADMIN' } }),
                db.user.count({ where: { role: 'ADMIN', business: { status: 'PENDING' } } }),
                db.user.count({ where: { role: 'ADMIN', business: { status: 'APPROVED' } } }),
                db.user.count({ where: { role: 'ADMIN', business: { status: 'REJECTED' } } }),
                db.offer.count(),
                db.user.count()
            ]);

            res.status(200).json({
                status: 'success',
                data: {
                    totalBusinesses,
                    pendingBusinesses,
                    approvedBusinesses,
                    rejectedBusinesses,
                    totalOffers,
                    totalUsers
                }
            });
        } catch (error) {
            next(error);
        }
    };
}

export const adminController = new AdminController();
