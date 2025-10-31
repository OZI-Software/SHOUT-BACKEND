import type { Request, Response, NextFunction } from 'express';
import logger  from '../utils/logger.js';
import type { IApiError } from '../types/index.d.ts';

/**
 * Centralized error handling middleware.
 * It catches errors thrown by controllers or services and sends a clean,
 * standardized response, preventing sensitive internal details from leaking.
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log the error for internal review, skipping 404/400 errors usually
  if (statusCode >= 500) {
    logger.error(`[API Error] ${req.method} ${req.originalUrl}`, {
      message: err.message,
      stack: err.stack,
      statusCode: statusCode,
    });
  } else {
     logger.warn(`[Client Error] ${req.method} ${req.originalUrl}`, { message: err.message, statusCode: statusCode });
  }

  // Structure the API error response
  const response: IApiError = {
    message: message,
    statusCode: statusCode,
  };

  if (process.env.NODE_ENV !== 'production' && err.details) {
      // Include detailed error info (e.g., Prisma validation failure) only in development
      response.details = err.details;
  }

  return res.status(statusCode).json(response);
};

export default errorMiddleware;