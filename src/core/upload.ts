import multer from 'multer'

// In-memory multer storage for images, with validation and limits
const storage = multer.memoryStorage()

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Unsupported file type'))
}

export const imageUpload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } })