import { Router } from 'express';
import { uploadsController, upload } from './uploads.controller.js';
import { authMiddleware, rolesMiddleware } from '../../core/middleware/auth.middleware.js';
import type { UserRole } from '@prisma/client';

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
      rolesMiddleware(['ADMIN', 'STAFF'] as unknown as UserRole[]),
      upload.single('file'),
      uploadsController.uploadImage,
    );
  }
}

export const uploadsRoutes = new UploadsRoutes();