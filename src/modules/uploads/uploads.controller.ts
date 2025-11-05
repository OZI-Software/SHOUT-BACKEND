import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../config/index.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HttpError } from '../../config/index.js';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${base}_${timestamp}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Unsupported file type'));
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB

class UploadsController {
  public uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new HttpError('Not authenticated', 401);
      // Role check can be enforced via route middleware
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        throw new HttpError('No file uploaded', 400);
      }

      // Build public URL: /uploads/<filename> served by express static
      const filename = path.basename(file.path);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/uploads/${filename}`;

      return res.status(201).json({ status: 'success', data: { url } });
    } catch (error) {
      next(error);
    }
  };
}

export const uploadsController = new UploadsController();