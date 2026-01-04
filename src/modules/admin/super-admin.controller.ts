import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import { HttpError } from '../../config/index.js';
import { db } from '../../core/db/prisma.js';
import { logger } from '../../core/utils/logger.js';
import type { BusinessStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

class SuperAdminController {
    /**
     * GET /api/v1/admin/offers
     * Get all offers with comprehensive statistics
     */
    public getAllOffersWithStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const offers = await db.offer.findMany({
                include: {
                    creator: {
                        select: {
                            email: true,
                            business: {
                                select: {
                                    businessId: true,
                                    businessName: true,
                                    category: true,
                                }
                            }
                        }
                    },
                    favoritedBy: {
                        select: { userId: true }
                    },
                    acceptances: {
                        select: {
                            id: true,
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            // Transform data to include counts
            const offersWithStats = offers.map(offer => ({
                ...offer,
                businessName: offer.creator.business?.businessName || 'N/A',
                businessCategory: offer.creator.business?.category || 'N/A',
                favoritesCount: offer.favoritedBy.length,
                totalAcceptances: offer.acceptances.length,
                redeemedCount: offer.acceptances.filter(a => a.status === 'REDEEMED').length,
                pendingCount: offer.acceptances.filter(a => a.status === 'PENDING').length,
            }));

            res.status(200).json({
                status: 'success',
                count: offersWithStats.length,
                data: offersWithStats
            });
        } catch (error) {
            logger.error('[SuperAdmin] Error fetching offers with stats:', error);
            next(error);
        }
    };

    /**
     * GET /api/v1/admin/businesses/all
     * Get all businesses with detailed information
     */
    public getAllBusinessesDetailed = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const businesses = await db.business.findMany({
                include: {
                    user: {
                        select: {
                            userId: true,
                            email: true,
                            mobileNumber: true,
                            name: true,
                            role: true,
                            createdOffers: {
                                select: {
                                    id: true,
                                    title: true,
                                    status: true,
                                    createdAt: true
                                }
                            }
                        }
                    },
                    reviews: {
                        select: {
                            rating: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            // Calculate average ratings
            const businessesWithStats = businesses.map(business => {
                const avgRating = business.reviews.length > 0
                    ? business.reviews.reduce((sum, r) => sum + r.rating, 0) / business.reviews.length
                    : 0;

                return {
                    ...business,
                    offersCount: business.user.createdOffers.length,
                    activeOffersCount: business.user.createdOffers.filter(o => o.status === 'ACTIVE').length,
                    averageRating: avgRating,
                    reviewsCount: business.reviews.length
                };
            });

            res.status(200).json({
                status: 'success',
                count: businessesWithStats.length,
                data: businessesWithStats
            });
        } catch (error) {
            logger.error('[SuperAdmin] Error fetching businesses:', error);
            next(error);
        }
    };

    /**
     * GET /api/v1/admin/businesses/:id/detailed
     * Get detailed information for a specific business
     */
    public getBusinessDetailed = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            const business = await db.business.findUnique({
                where: { businessId: id as string },
                include: {
                    user: {
                        select: {
                            userId: true,
                            email: true,
                            mobileNumber: true,
                            name: true,
                            role: true,
                            createdOffers: {
                                include: {
                                    favoritedBy: true,
                                    acceptances: true
                                },
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    },
                    reviews: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    email: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (!business) {
                throw new HttpError('Business not found', 404);
            }

            // Calculate statistics
            const offersWithStats = business.user.createdOffers.map(offer => ({
                ...offer,
                favoritesCount: offer.favoritedBy.length,
                acceptancesCount: offer.acceptances.length,
                redeemedCount: offer.acceptances.filter(a => a.status === 'REDEEMED').length
            }));

            const avgRating = business.reviews.length > 0
                ? business.reviews.reduce((sum, r) => sum + r.rating, 0) / business.reviews.length
                : 0;

            res.status(200).json({
                status: 'success',
                data: {
                    ...business,
                    user: {
                        ...business.user,
                        createdOffers: offersWithStats
                    },
                    averageRating: avgRating,
                    reviewsCount: business.reviews.length
                }
            });
        } catch (error) {
            logger.error('[SuperAdmin] Error fetching business details:', error);
            next(error);
        }
    };

    /**
     * POST /api/v1/admin/businesses/onboard
     * Onboard a new business from admin dashboard
     */
    public onboardBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Not authenticated', 401);

            const {
                email,
                mobileNumber,
                name,
                password,
                businessName,
                description,
                address,
                pinCode,
                latitude,
                longitude,
                googleMapsLink,
                openingTime,
                closingTime,
                workingDays,
                isOpen24Hours,
                abn,
                category,
                images,
                autoApprove
            } = req.body;

            // Validate required fields
            if (!email && !mobileNumber) {
                throw new HttpError('Either email or mobile number is required', 400);
            }
            if (!businessName || !description || !address || !pinCode) {
                throw new HttpError('Missing required business fields', 400);
            }

            // Check if user already exists
            const existingUser = await db.user.findFirst({
                where: {
                    OR: [
                        email ? { email } : {},
                        mobileNumber ? { mobileNumber } : {}
                    ].filter(obj => Object.keys(obj).length > 0)
                }
            });

            if (existingUser) {
                throw new HttpError('User with this email or mobile number already exists', 400);
            }

            // Hash password if provided
            const passwordHash = password ? await bcrypt.hash(password, 10) : null;

            // Create user and business in a transaction
            const result = await db.$transaction(async (tx) => {
                // Create user
                const user = await tx.user.create({
                    data: {
                        email,
                        mobileNumber,
                        name,
                        passwordHash,
                        role: 'ADMIN'
                    }
                });

                // Create business
                const business = await tx.business.create({
                    data: {
                        userId: user.userId,
                        businessName,
                        description,
                        address,
                        pinCode: parseInt(pinCode),
                        latitude: latitude ? parseFloat(latitude) : 0,
                        longitude: longitude ? parseFloat(longitude) : 0,
                        googleMapsLink: googleMapsLink || '',
                        openingTime,
                        closingTime,
                        workingDays,
                        isOpen24Hours: isOpen24Hours || false,
                        abn,
                        category,
                        images: images || [],
                        status: autoApprove ? ('APPROVED' as unknown as BusinessStatus) : ('PENDING' as unknown as BusinessStatus),
                        approvedAt: autoApprove ? new Date() : null,
                        approvedBy: autoApprove ? req.user!.userId : null
                    }
                });

                return { user, business };
            });

            logger.info(`[SuperAdmin] Onboarded business ${result.business.businessId} by ${req.user.userId}`);

            res.status(201).json({
                status: 'success',
                message: 'Business onboarded successfully',
                data: result
            });
        } catch (error) {
            logger.error('[SuperAdmin] Error onboarding business:', error);
            next(error);
        }
    };

    /**
     * POST /api/v1/admin/businesses/:id/create-admin
     * Create an admin user for an existing business
     */
    public createBusinessAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user) throw new HttpError('Not authenticated', 401);

            const { id } = req.params;
            const { email, mobileNumber, name, password } = req.body;

            // Validate required fields
            if (!email && !mobileNumber) {
                throw new HttpError('Either email or mobile number is required', 400);
            }
            if (!password) {
                throw new HttpError('Password is required', 400);
            }

            // Check if business exists
            const business = await db.business.findUnique({
                where: { businessId: id as string }
            });

            if (!business) {
                throw new HttpError('Business not found', 404);
            }

            // Check if user already exists
            const existingUser = await db.user.findFirst({
                where: {
                    OR: [
                        email ? { email } : {},
                        mobileNumber ? { mobileNumber } : {}
                    ].filter(obj => Object.keys(obj).length > 0)
                }
            });

            if (existingUser) {
                throw new HttpError('User with this email or mobile number already exists', 400);
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Update business to link to new admin user
            const newAdmin = await db.user.create({
                data: {
                    email,
                    mobileNumber,
                    name,
                    passwordHash,
                    role: 'ADMIN',
                    business: {
                        connect: { businessId: id as string }
                    }
                },
                include: {
                    business: true
                }
            });

            logger.info(`[SuperAdmin] Created admin ${newAdmin.userId} for business ${id} by ${req.user.userId}`);

            res.status(201).json({
                status: 'success',
                message: 'Admin created successfully',
                data: newAdmin
            });
        } catch (error) {
            logger.error('[SuperAdmin] Error creating business admin:', error);
            next(error);
        }
    };
}

export const superAdminController = new SuperAdminController();
