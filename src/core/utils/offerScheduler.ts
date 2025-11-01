import cron from 'node-cron';
import {db} from '../db/prisma.js'
import { OfferStatus } from '@prisma/client';
import { logger } from './logger.js';

// --- Offer Status Update Functions ---

// Update offers that are scheduled to become active    
const activateOffers = async () => {
  const now = new Date();
  try {
    const { count } = await db.offer.updateMany({
      where: {
        status: OfferStatus.SCHEDULED,
        startDateTime: { lte: now }, // less than or equal to now
      },
      data: {
        status: OfferStatus.ACTIVE,
      },
    });
    if (count > 0) {
      logger.info(`Cron: Activated ${count} offers.`);
    }
  } catch (error) {
    logger.error('Cron: Failed to activate offers.', error);
  }
};

// Update offers that have passed their end time to expired
const expireOffers = async () => {
  const now = new Date();
  try {
    const { count } = await db.offer.updateMany({
      where: {
        status: OfferStatus.ACTIVE,
        endDateTime: { lte: now }, // less than or equal to now
      },
      data: {
        status: OfferStatus.EXPIRED,
      },
    });
    if (count > 0) {
      logger.info(`Cron: Expired ${count} offers.`);
    }
  } catch (error) {
    logger.error('Cron: Failed to expire offers.', error);
  }
};


// --- Cron Job Scheduling ---

export const startOfferScheduler = () => {
  logger.info('Starting Offer Scheduler Cron Jobs...');

  // Run every minute (for simplicity/testing)
  // In a real application, you might run this less frequently (e.g., every 5 minutes)
  const cronExpression = '* * * * *';

  // 1. Job to activate scheduled offers
  cron.schedule(cronExpression, activateOffers, {
    scheduled: true,
    timezone: 'UTC', // Best practice: use UTC for all scheduled tasks
  } as any);

  // 2. Job to expire active offers
  cron.schedule(cronExpression, expireOffers, {
    scheduled: true,
    timezone: 'UTC',
  }as any);

  logger.info(`Offer Cron Jobs scheduled to run with expression: '${cronExpression}'`);
};