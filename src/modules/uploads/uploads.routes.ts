import { Router } from 'express';
import { uploadsController, upload } from './uploads.controller.js';
import { authMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

class UploadsRoutes {
  public router: Router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Restrict to ADMIN and STAFF for now
    this.router.post(
      '/image',
      authMiddleware,
      rolesMiddleware([UserRole.ADMIN, UserRole.STAFF]),
      upload.single('file'),
      uploadsController.uploadImage,
    );
  }
}

export const uploadsRoutes = new UploadsRoutes();