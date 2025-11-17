import { v2 as cloudinary } from 'cloudinary'

// Read credentials from environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || ''
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || ''

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  // Warn in development; in production this should be set properly
  console.warn('[Cloudinary] Missing credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in environment.')
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
})

export interface CloudinaryUploadResult {
  url: string
  secure_url: string
  public_id: string
  resource_type: string
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = 'shout/uploads',
  filename?: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    // Derive a safe public_id from filename to avoid type issues with filename_override
    const publicId = filename
      ? filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')
      : undefined

    const options: any = {
      folder,
      resource_type: 'image',
      use_filename: true,
      unique_filename: false,
    }
    if (publicId) options.public_id = publicId

    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error)
        if (!result) return reject(new Error('No result from Cloudinary'))
        resolve({
          url: result.url!,
          secure_url: result.secure_url!,
          public_id: result.public_id!,
          resource_type: result.resource_type!,
        })
      }
    )
    stream.end(buffer)
  })
}

export default cloudinary