import { db } from '../../core/db/prisma.js';
import type { User } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import type { JwtPayload } from '../../config/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, FRONTEND_BASE_URL } from '../../config/index.d.js';
import { logger } from '../../core/utils/logger.js';
import { emailService } from '../../core/email/email.service.js';

// Define DTOs (Data Transfer Objects) for better type safety
interface RegisterDto {
  email: string;
  password?: string; // Optional for Business (set later)
  isBusiness: boolean; // Flag to indicate business registration

  // Business fields (only required if isBusiness is true)
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

class AuthService {
  private readonly saltRounds = 10;

  /**
   * Registers a new User, optionally creating a Business profile for them.
   * This handles the simultaneous signup and business registration.
   */
  public async register(dto: RegisterDto): Promise<string | null> {
    const { email, password, isBusiness, ...businessData } = dto;

    logger.info('[AuthService] Registering user with email:', email);

    // 1. Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new HttpError('User already exists with this email', 409);
    }

    // 2. Hash the password if provided
    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, this.saltRounds);
    } else if (!isBusiness) {
      throw new HttpError('Password is required for staff accounts', 400);
    }

    const role = isBusiness ? 'ADMIN' : 'STAFF';

    // 3. Perform registration in a database transaction
    try {
      const newUser = await db.$transaction(async (tx) => {

        // --- Step 3a: Create User ---
        const user = await tx.user.create({
          data: {
            email,
            role,
            passwordHash: hashedPassword,
          },
        });

        // --- Step 3b: Create Business if requested ---
        if (isBusiness) {
          logger.info('[AuthService] Creating business profile for user:', user.userId);
          const missing: string[] = [];
          if (!businessData.businessName) missing.push('businessName');
          if (!businessData.description) missing.push('description');
          if (!businessData.address) missing.push('address');
          if (!businessData.pinCode) missing.push('pinCode');
          if (!businessData.latitude) missing.push('latitude');
          if (!businessData.longitude) missing.push('longitude');
          if (!businessData.googleMapsLink) missing.push('googleMapsLink');
          if (missing.length > 0) {
            throw new HttpError(`Missing required business fields: ${missing.join(', ')}`, 400);
          }

          await tx.business.create({
            data: {
              businessName: businessData.businessName!,
              description: businessData.description!,
              address: businessData.address!,
              pinCode: Number(businessData.pinCode),
              latitude: Number(businessData.latitude),
              longitude: Number(businessData.longitude),
              googleMapsLink: String(businessData.googleMapsLink),
              // New approval workflow fields
              status: 'PENDING',
              userId: user.userId,
            },
          });
        }
        return user;
      });

      // 4. Generate JWT or return null for pending business
      if (isBusiness) {
        return null;
      }
      return this.generateToken(newUser);
    } catch (error) {
      // Catch HttpErrors thrown within the transaction
      if (error instanceof HttpError) throw error;

      // Handle Prisma errors (e.g., if a relation fails)
      if ((error as any).code === 'P2003') {
        throw new HttpError('Invalid input data provided for registration', 400);
      }
      logger.error('Registration error:', error);
      throw new HttpError('Registration failed due to server error', 500);
    }
  }

  /**
   * Authenticates a user and returns a JWT.
   */
  public async login(dto: LoginDto): Promise<string> {
    // 1. Find user by email (include password hash in a real setup)
    const user = await db.user.findUnique({
      where: { email: dto.email },
      select: {
        userId: true,
        email: true,
        role: true,
        passwordHash: true,
        business: { select: { status: true } }
      },
    });

    if (!user) {
      throw new HttpError('Invalid credentials', 401);
    }

    // Check business status
    if (user.role === 'ADMIN' && user.business) {
      if (user.business.status === 'PENDING') {
        throw new HttpError('Your account is pending approval. You will be notified via email once approved.', 403);
      }
      if (user.business.status === 'REJECTED') {
        throw new HttpError('Your account application has been rejected.', 403);
      }
    }

    // Check if password exists (it might be null for pending businesses)
    if (!user.passwordHash) {
      throw new HttpError('Please set your password via the link sent to your email.', 401);
    }

    // 2. Compare password securely using bcrypt
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isMatch) {
      throw new HttpError('Invalid credentials', 401);
    }

    // 3. Generate JWT
    return this.generateToken(user);
  }

  /**
   * Generates a JWT for the given user.
   */
  private generateToken(user: Pick<User, 'userId' | 'email' | 'role'>): string {
    const payload: JwtPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Initiates a password reset by emailing a signed reset token.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    const user = await db.user.findUnique({ where: { email }, select: { userId: true, email: true } });
    if (!user) {
      // Do not reveal user existence
      return;
    }
    const token = jwt.sign({ type: 'reset', userId: user.userId, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${FRONTEND_BASE_URL}/auth/reset?token=${encodeURIComponent(token)}`;
    await emailService.sendPasswordReset(user.email, resetUrl);
    logger.info('[Auth] Sent password reset email to', user.email);
  }

  /**
   * Confirms password reset using the token and sets the new password.
   */
  public async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded || decoded.type !== 'reset' || !decoded.userId) {
        throw new HttpError('Invalid reset token', 400);
      }
      const user = await db.user.findUnique({ where: { userId: decoded.userId }, select: { userId: true } });
      if (!user) throw new HttpError('Invalid reset token', 400);
      const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
      await db.user.update({ where: { userId: user.userId }, data: { passwordHash } });
      logger.info('[Auth] Password reset successful for user', user.userId);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError('Invalid or expired reset token', 400);
    }
  }
}

export const authService = new AuthService();