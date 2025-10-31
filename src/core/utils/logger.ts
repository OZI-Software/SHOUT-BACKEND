import winston from 'winston';
import 'winston-daily-rotate-file';
import { NODE_ENV } from '../../config/index.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    // For errors, include the stack trace
    if (stack) {
      return `${timestamp} ${level.toUpperCase()}: ${message}\n${stack}`;
    }
    return `${timestamp} ${level.toUpperCase()}: ${message}`;
  })
);

// Define transports
const transports: (winston.transport | winston.transport[])[] = [
  // Console transport for development/production
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
];

// Add file transports in production/staging
if (NODE_ENV === 'production' || NODE_ENV === 'staging') {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    })
  );
}

// Create the logger instance
export const logger = winston.createLogger({
  level: NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: transports,
});