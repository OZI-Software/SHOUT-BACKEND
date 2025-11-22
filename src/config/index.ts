import type { Request } from 'express';
import type { User, UserRole } from '@prisma/client';

// Type for the JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Extend Express Request object to include the authenticated user
export interface AuthRequest extends Request {
  user?: User; // Or a simpler type with just the necessary fields from JwtPayload
}

// Custom error type for better error handling
export class HttpError extends Error {
  public status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

import * as dotenv from 'dotenv';
dotenv.config();

// Define a type for your configuration
interface Config {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  FRONTEND_BASE_URL: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'YOUR_SECURE_DEFAULT_SECRET', // **MUST be changed in .env**
  BREVO_API_KEY: (process.env.BREVO_API_KEY || '').trim(),
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'SHOUT Notifications',
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
};

export const { PORT, NODE_ENV, JWT_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, FRONTEND_BASE_URL } = config;