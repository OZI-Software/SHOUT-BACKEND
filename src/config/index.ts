import type { Request } from 'express';
import type { User, userRole } from '../../generated/prisma/client.js';

// Type for the JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: userRole;
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