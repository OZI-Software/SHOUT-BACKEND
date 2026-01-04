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
}

export class AnalyticsService {

    public async trackEvent(dto: TrackEventDto) {
        try {
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
                    await db.offer.update({ where: { id: dto.offerId }, data: { viewCount: { increment: 1 } } }).catch(() => { });
                } else if (dto.type === 'OFFER_IMPRESSION') {
                    await db.offer.update({ where: { id: dto.offerId }, data: { impressionCount: { increment: 1 } } }).catch(() => { });
                }
            }
        } catch (error) {
            logger.error('Error tracking analytics event:', error);
            // Fail silently to not block user flow, but log error
        }
    }

    public async getOfferStats(query: AnalyticsQueryDto) {
        let { startDate, endDate } = this.getDateRange(query);

        logger.info(`[Analytics] Fetching stats from ${startDate} to ${endDate}`);

        // We need to aggregate events grouped by offerId
        // Prisma grouping is limited for complex multi-counts in one go, 
        // so we might need multiple queries or raw query.
        // However, for "Most Popular", we usually sort by one metric (View or Impression).

        // Let's get all offers first, then attach analytics?
        // OR aggregate events and then fetch offer details. Aggregating events is better for performance.

        /*
          Strategy:
          1. Group AnalyticsEvents by offerId where type=OFFER_VIEW, count.
          2. Group AnalyticsEvents by offerId where type=OFFER_IMPRESSION, count.
          3. Group AnalyticsEvents by offerId where type=BUSINESS_VIEW (if linked to offer context? but businessId is usually separate. 
             Ideally BUSINESS_VIEW is linked to businessId. We can track offer->business click as BUSINESS_VIEW with offerId?).
             Let's assume the frontend sends offerId for BUSINESS_VIEW if it came from an offer card.
        */

        const whereClause = {
            createdAt: {
                gte: startDate,
                lte: endDate
            },
            offerId: { not: null }
        };

        // Use groupBy to get counts
        const [views, impressions, bizVisits] = await Promise.all([
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
                where: { ...whereClause, type: 'BUSINESS_VIEW' },
                _count: { _all: true }
            })
        ]);

        // Also get favorites (from FavoriteOffer table)
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
        process(bizVisits, 'businessVisitCount');
        process(favorites, 'favoriteCount');
        process(acceptances, 'acceptanceCount');

        // Fetch Offer Details for the keys in statsMap
        const offerIds = Array.from(statsMap.keys());

        // Ensure we fetch at least some offers even if no stats (if query demands?)
        // But usually "Analytics" shows active items.
        // If we want "All Offers with their stats (0 if none)", we should fetch all relevant offers first.
        // The user said "analytics of each and every offer".
        // So we should fetch ALL offers (with pagination?) and map stats to them.

        const allOffers = await db.offer.findMany({
            select: {
                id: true,
                title: true,
                imageUrl: true,
                status: true,
                creator: {
                    select: {
                        business: {
                            select: { businessName: true }
                        }
                    }
                }
            }
        });

        const result = allOffers.map(offer => {
            const stats = statsMap.get(offer.id) || {};
            return {
                ...offer,
                businessName: offer.creator.business?.businessName,
                metrics: {
                    views: stats.viewCount || 0,
                    impressions: stats.impressionCount || 0,
                    businessVisits: stats.businessVisitCount || 0,
                    favorites: stats.favoriteCount || 0,
                    acceptances: stats.acceptanceCount || 0
                }
            };
        });

        // Sort by popularity (views + impressions + acceptances?)
        // Default sort: views desc
        result.sort((a, b) => b.metrics.views - a.metrics.views);

        return result;
    }

    private getDateRange(query: AnalyticsQueryDto): { startDate: Date, endDate: Date } {
        const now = new Date();
        let startDate = new Date(0); // Epoch
        let endDate = now;

        if (query.startDate && query.endDate) {
            startDate = new Date(query.startDate);
            endDate = new Date(query.endDate);
            // Adjust endDate to end of day if it's just a date string? 
            // Assuming ISO strings from frontend
        } else if (query.period === 'today') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (query.period === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
        } else if (query.period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        return { startDate, endDate };
    }
}

export const analyticsService = new AnalyticsService();
