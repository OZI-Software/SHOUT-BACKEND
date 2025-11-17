import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import multer from 'multer';
import { HttpError } from '../../config/index.js';
import { uploadBufferToCloudinary } from '../../core/cloudinary.js';

// Use in-memory storage; no local filesystem writes
const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Unsupported file type'));
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

class UploadsController {
  public uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file || !file.buffer) {
        throw new HttpError('No file uploaded', 400);
      }

      // Upload to Cloudinary
      const result = await uploadBufferToCloudinary(file.buffer, 'shout/uploads', file.originalname);

      return res.status(201).json({
        status: 'success',
        data: {
          url: result.secure_url || result.url,
          public_id: result.public_id,
          resource_type: result.resource_type,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const uploadsController = new UploadsController();