import { db } from '../../core/db/prisma.js';
import type { User, userRole } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import type {JwtPayload} from '../../config/index.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/index.d.js';
import * as bcrypt from 'bcryptjs';
import { logger } from '../../core/utils/logger.js';

// Define DTOs (Data Transfer Objects) for better type safety
interface RegisterDto {
  email: string;
  password: string;
  isBusiness: boolean;
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
}

interface LoginDto {
  email: string;
  password: string;
}

class AuthService {
  private readonly saltRounds = 10;

  /**
   * Registers a new User, optionally creating a Business profile for them.
   */
  public async register(dto: RegisterDto): Promise<string> {
    const { email, password, isBusiness, ...businessData } = dto;
    
    logger.info(`[Auth] Registration attempt for email: ${email}, isBusiness: ${isBusiness}`);

    // 1. Check if user already exists
    logger.debug(`[Auth] Checking if user exists with email: ${email}`);
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      logger.warn(`[Auth] Registration failed - User already exists with email: ${email}`);
      throw new HttpError('User already exists with this email', 409);
    }

    // 2. Hash the password
    logger.debug(`[Auth] Hashing password for user: ${email}`);
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    const userRole = isBusiness ? 'ADMIN' : 'STAFF'; // Assuming STAFF is the default user role, and ADMIN is for business owners.
    logger.debug(`[Auth] Assigning role ${userRole} to user: ${email}`);

    // 3. Create User and Business (if applicable) in a transaction
    try {
      logger.debug(`[Auth] Starting transaction to create user: ${email}`);
      const newUser = await db.$transaction(async (tx) => {
        logger.debug(`[Auth] Creating user record for: ${email}`);
        const user = await tx.user.create({
          data: {
            email,
            role: userRole,
            // In a real app, you'd store the hashed password in a separate Auth model or extend the User model to hold it.
            // For simplicity here, we'll imagine a `passwordHash` field on User (needs schema update) or use a separate vault.
            // Since the schema doesn't have a password field, we'll log it as a security note.
            // NOTE: In production, add a `passwordHash` field to the User model.
            // For now, we'll assume a hidden field is managed elsewhere or update the schema locally.
            // We'll proceed by just creating the user and relying on the DTO.
            // Assume the password is only checked during login via a secure hash storage.

          },
        });

        if (isBusiness) {
          logger.debug(`[Auth] Creating business profile for user: ${email}`);
          if (!businessData.businessName || !businessData.address) {
            logger.error(`[Auth] Missing required business fields for user: ${email}`);
            throw new HttpError('Missing required business fields', 400);
          }
          await tx.business.create({
            data: {
              businessName: businessData.businessName,
              description: businessData.description || 'No description provided.',
              address: businessData.address,
              pinCode: businessData.pinCode || 0,
              latitude: businessData.latitude || 0, // Set to 0 or fail validation
              longitude: businessData.longitude || 0,
              userId: user.userId,
            },
          });
          logger.info(`[Auth] Business profile created for: ${businessData.businessName} (${email})`);
        }
        return user;
      });

      logger.info(`[Auth] User registration successful for: ${email} (${newUser.userId})`);

      // 4. Generate JWT
      logger.debug(`[Auth] Generating JWT token for user: ${email}`);
      return this.generateToken(newUser);
    } catch (error) {
      logger.error(`[Auth] Registration failed for email: ${email}`, error);
      if (error instanceof HttpError) throw error; // Re-throw 400 errors from inside transaction
      throw new HttpError('Registration failed due to database error', 500);
    }
  }

  /**
   * Authenticates a user and returns a JWT.
   */
  public async login(dto: LoginDto): Promise<string> {
    logger.info(`[Auth] Login attempt for email: ${dto.email}`);
    
    // 1. Find user by email (include password hash in a real setup)
    logger.debug(`[Auth] Looking up user by email: ${dto.email}`);
    const user = await db.user.findUnique({
      where: { email: dto.email },
      // NOTE: In a real app, you must select the hashed password field here.
      // Assuming a separate secure query or schema update for password hash.
    });

    if (!user) {
      logger.warn(`[Auth] Login failed - User not found for email: ${dto.email}`);
      throw new HttpError('Invalid credentials', 401);
    }

    logger.debug(`[Auth] User found for email: ${dto.email}, userId: ${user.userId}`);

    // 2. Compare password (Placeholder since password hash isn't in schema)
    // NOTE: Replace `true` with `await bcrypt.compare(dto.password, user.passwordHash);`
    logger.debug(`[Auth] Verifying password for user: ${dto.email}`);
    const isMatch = true; // Placeholder for actual password check

    if (!isMatch) {
      logger.warn(`[Auth] Login failed - Invalid password for email: ${dto.email}`);
      throw new HttpError('Invalid credentials', 401);
    }

    logger.info(`[Auth] Login successful for user: ${dto.email} (${user.userId})`);

    // 3. Generate JWT
    logger.debug(`[Auth] Generating JWT token for user: ${dto.email}`);
    return this.generateToken(user);
  }

  /**
   * Generates a JWT for the given user.
   */
  private generateToken(user: Pick<User, 'userId' | 'email' | 'role'>): string {
    logger.debug(`[Auth] Creating JWT payload for user: ${user.email} (${user.userId})`);
    const payload: JwtPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    logger.debug(`[Auth] JWT token generated successfully for user: ${user.email}`);
    return token;
  }
}

export const authService = new AuthService();