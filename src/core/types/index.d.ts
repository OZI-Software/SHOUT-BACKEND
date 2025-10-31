import { Request } from 'express';
import { Role } from '../../../generated/prisma/client.js';

/**
 * Interface for the Request object after it has passed through the authentication middleware.
 * This ensures type safety when accessing user context.
 */
export interface IAuthRequest extends Request {
  userId: string;
//   businessId: string;
  userRole: Role;
}

/**
 * Interface for general API error responses
 */
export interface IApiError {
  message: string;
  statusCode: number;
  details?: any;
}
