import express from 'express';
import type { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorMiddleware } from './core/middleware/error.middleware.js';
import { logger } from './core/utils/logger.js';

// Import all module routes
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { businessRoutes } from './modules/business/business.routes.js';
import { offersRoutes } from './modules/offers/offers.routes.js';
import { uploadsRoutes } from './modules/uploads/uploads.routes.js';
import adminRoutes from './modules/admin/business-approvals.routes.js';


export class App {
  public app: Application;

  constructor() {
    logger.info('[App] Initializing Express application');
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    logger.info('[App] Express application initialization completed');
  }

  private initializeMiddleware(): void {
    logger.debug('[App] Setting up middleware');
    
    // Security middleware
    logger.debug('[App] Configuring Helmet security middleware');
    this.app.use(helmet());
    
    // CORS configuration
    logger.debug('[App] Configuring CORS middleware');
    this.app.use(cors({
      origin: true, // Allow all origins for simplicity, but restrict in production
      credentials: true,
    }));
    
    // Body parsing middleware
    logger.debug('[App] Configuring body parsing middleware');
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    // Cloudinary is used for asset storage; local static serving is no longer needed
    
    logger.debug('[App] Middleware setup completed');
  }

  private initializeRoutes(): void {
    logger.debug('[App] Setting up routes');
    
    // Health check route
    logger.debug('[App] Configuring health check route: /api/health');
    this.app.get('/api/health', (req, res) => {
      logger.debug('[App] Health check endpoint accessed');
      res.status(200).send('OK');
    });

    // Main application routes
    logger.debug('[App] Configuring authentication routes: /api/v1/auth');
    this.app.use('/api/v1/auth', authRoutes.router);
    
    logger.debug('[App] Configuring user routes: /api/v1/users');
    this.app.use('/api/v1/users', userRoutes.router);
    
    logger.debug('[App] Configuring business routes: /api/v1/business');
    this.app.use('/api/v1/business', businessRoutes.router);
    
    logger.debug('[App] Configuring offers routes: /api/v1/offers');
    this.app.use('/api/v1/offers', offersRoutes.router);
    // Upload routes for admin/staff to upload images
    this.app.use('/api/v1/uploads', uploadsRoutes.router);
    // Admin routes for business approvals
    this.app.use('/api/v1/admin', adminRoutes);
    
    logger.debug('[App] Routes setup completed');
  }

  private initializeErrorHandling(): void {
    logger.debug('[App] Setting up error handling middleware');
    // Must be the last middleware mounted
    this.app.use(errorMiddleware);
    logger.debug('[App] Error handling middleware configured');
  }

  public listen(): void {
    const port = process.env.PORT || 5000;
    logger.info(`[App] Starting server on port ${port}`);
    
    this.app.listen(port, () => {
      logger.info(`=================================`);
      logger.info(`🚀 App listening on port ${port}`);
      logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`   Process ID: ${process.pid}`);
      logger.info(`=================================`);
    });
  }
}