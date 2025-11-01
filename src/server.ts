import { App } from './app.js';
import { startOfferScheduler } from './core/utils/offerScheduler.js';
import { logger } from './core/utils/logger.js';

const main = () => {
  logger.info('[Server] Starting application...');
  
  try {
    // 1. Start the Express App
    logger.info('[Server] Initializing Express application');
    const app = new App();
    app.listen();
    logger.info('[Server] Express application started successfully');

    // 2. Start the cron jobs
    logger.info('[Server] Starting offer scheduler');
    startOfferScheduler();
    logger.info('[Server] Offer scheduler started successfully');

    logger.info('[Server] Application startup completed successfully');

  } catch (error) {
    logger.error('[Server] FATAL: Could not start the server.', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[Server] SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();