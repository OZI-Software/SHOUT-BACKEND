import { db } from '../../core/db/prisma.js';
import { AnalyticsEventType } from '@prisma/client';
import { logger } from '../../core/utils/logger.js';
import { HttpError } from '../../config/index.js';

interface TrackEventDto {
    type: AnalyticsEventType;
    offerId?: string;
    businessId?: string;
    userId?: string;
}

interface AnalyticsQueryDto {
    period?: 'today' | 'week' | 'month' | 'custom';
    startDate?: string;
    endDate?: string;
    limit?: number;
    businessId?: string;
}

export class AnalyticsService {

    public async trackEvent(dto: TrackEventDto) {
        logger.info(`[Analytics] Tracking event: ${dto.type} | Offer: ${dto.offerId} | Business: ${dto.businessId} | User: ${dto.userId}`);
        try {
            // If businessId is missing but offerId is present, fetch it from the offer
            if (dto.offerId && !dto.businessId) {
                const offer = await db.offer.findUnique({
                    where: { id: dto.offerId },
                    select: {
                        creator: {
                            select: { business: { select: { businessId: true } } }
                        }
                    }
                });
                if (offer?.creator?.business?.businessId) {
                    // eslint-disable-next-line no-param-reassign
                    dto.businessId = offer.creator.business.businessId;
                }
            }

            await db.analyticsEvent.create({
                data: {
                    type: dto.type,
                    offerId: dto.offerId ?? null,
                    businessId: dto.businessId ?? null,
                    userId: dto.userId ?? null
                }
            });
            // Optionally increment counters on Offer model for quick access (if desired)
            if (dto.offerId) {
                if (dto.type === 'OFFER_VIEW') {
                    await db.offer.update({ where: { id: dto.offerId }, data: { viewCount: { increment: 1 } } });
                } else if (dto.type === 'OFFER_IMPRESSION') {
                    await db.offer.update({ where: { id: dto.offerId }, data: { impressionCount: { increment: 1 } } });
                }
            }
        } catch (error) {
            logger.error('Error tracking analytics event:', error);
            // Log full error details including stack trace if available
            if (error instanceof Error) {
                logger.error(error.stack);
            }
            throw error; // Re-throw to make it visible to controller
        }
    }

    public async getOfferStats(query: AnalyticsQueryDto) {
        let { startDate, endDate } = this.getDateRange(query);
        const { businessId } = query;
        logger.info(`[Analytics Debug] Date Range: Start=${startDate.toISOString()}, End=${endDate.toISOString()}`);
        logger.info(`[Analytics] Fetching stats from ${startDate} to ${endDate} ${businessId ? `for business ${businessId}` : ''}`);

        const whereClause: any = {
            createdAt: {
                gte: startDate,
                lte: endDate
            },
            offerId: { not: null }
        };

        if (businessId) {
            whereClause.businessId = businessId;
        }

        // Use groupBy to get counts
        const [views, impressions, shares] = await Promise.all([
            db.analyticsEvent.groupBy({
                by: ['offerId'],
                where: { ...whereClause, type: 'OFFER_VIEW' },
                _count: { _all: true }
            }),
            db.analyticsEvent.groupBy({
                by: ['offerId'],
                where: { ...whereClause, type: 'OFFER_IMPRESSION' },
                _count: { _all: true }
            }),
            db.analyticsEvent.groupBy({
                by: ['offerId'],
                where: { ...whereClause, type: 'OFFER_SHARE' },
                _count: { _all: true }
            })
        ]);

        // Also get favorites (from FavoriteOffer table)
        // Favorites might not have businessId directly on them, so filtering by businessId for favorites
        // requires joining with Offer. Prisma groupBy doesn't support relation filtering easily.
        // For accurate business level favorites, we'd need to fetch favorites that map to offers of this business.
        // Simplified approach: Get all favorites for offers, then in memory filtering if needed (or assume downstream filtering by offer list).
        // BUT if we filter the "Output List" by businessId, and map stats to those offers, we get the correct data.
        // The only issue is if "global total" stats are needed.
        // We will filter the *Offers* list by businessId. The aggregated stats key-value map can be global, 
        // as we only look up keys present in the Offer list.

        const favorites = await db.favoriteOffer.groupBy({
            by: ['offerId'],
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _count: { _all: true }
        });

        // Acceptances (Check OfferAcceptance table)
        const acceptances = await db.offerAcceptance.groupBy({
            by: ['offerId'],
            where: {
                acceptedAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            _count: { _all: true }
        });

        // Consolidate Data
        const statsMap = new Map<string, any>();

        const process = (list: any[], key: string) => {
            list.forEach(item => {
                const id = item.offerId;
                if (!id) return;
                if (!statsMap.has(id)) statsMap.set(id, { offerId: id });
                statsMap.get(id)[key] = item._count._all;
            });
        };

        process(views, 'viewCount');
        process(impressions, 'impressionCount');
        // process(bizVisits, 'businessVisitCount'); // Removed as logic was flawed for per-offer attribution
        process(favorites, 'favoriteCount');
        process(acceptances, 'acceptanceCount');
        process(shares, 'shareCount');

        // Fetch Offers
        const offerWhere: any = {};
        if (businessId) {
            offerWhere.creator = {
                business: {
                    id: businessId
                }
            };
        }

        const allOffers = await db.offer.findMany({
            where: offerWhere,
            select: {
                id: true,
                title: true,
                imageUrl: true,
                status: true,
                creator: {
                    select: {
                        business: {
                            select: { businessName: true, businessId: true }
                        }
                    }
                }
            }
        });

        // Global Business Visits (Include those without offerId)
        const businessVisitWhere: any = {
            createdAt: { gte: startDate, lte: endDate },
            type: 'BUSINESS_VIEW'
        };
        if (businessId) {
            businessVisitWhere.businessId = businessId;
        }
        const totalBusinessVisits = await db.analyticsEvent.count({ where: businessVisitWhere });

        // Sum up other metrics from the grouped data for convenience, or fetch counts
        const totalViews = views.reduce((acc, curr) => acc + curr._count._all, 0);
        const totalImpressions = impressions.reduce((acc, curr) => acc + curr._count._all, 0);
        const totalFavorites = favorites.reduce((acc, curr) => acc + curr._count._all, 0);
        const totalShares = shares.reduce((acc, curr) => acc + curr._count._all, 0);

        const items = allOffers.map(offer => {
            const stats = statsMap.get(offer.id) || {};
            return {
                ...offer,
                businessId: offer.creator.business?.businessId,
                businessName: offer.creator.business?.businessName,
                metrics: {
                    views: stats.viewCount || 0,
                    impressions: stats.impressionCount || 0,
                    businessVisits: stats.businessVisitCount || 0,
                    favorites: stats.favoriteCount || 0,
                    acceptances: stats.acceptanceCount || 0,
                    shares: stats.shareCount || 0
                }
            }
        });



        // Sorting
        items.sort((a, b) => b.metrics.views - a.metrics.views);

        return {
            items,
            totals: {
                views: totalViews,
                impressions: totalImpressions,
                businessVisits: totalBusinessVisits,
                favorites: totalFavorites,
                shares: totalShares
            }
        }

    }

    private getDateRange(query: AnalyticsQueryDto): { startDate: Date, endDate: Date } {
        const now = new Date();
        // Clone for endDate to prevent it being mutated if 'now' is mutated
        let endDate = new Date(now);
        let startDate = new Date(0); // Epoch

        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
            // Adjust endDate to end of day if it's just a date string? 
            // Assuming ISO strings from frontend
        } else if (query.period === 'today') {
            // Clone now for start date calculation
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
        } else if (query.period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
            // Clone now for start date calculation
            startDate = new Date(now);
            startDate.setDate(diff);
            startDate.setHours(0, 0, 0, 0);
        } else if (query.period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return { startDate, endDate };
    }
}

export const analyticsService = new AnalyticsService();
