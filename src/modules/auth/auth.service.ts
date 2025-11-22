import { db } from '../../core/db/prisma.js';
import type { User } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import type { JwtPayload } from '../../config/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, FRONTEND_BASE_URL } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';
import { emailService } from '../../core/email/email.service.js';

export interface RegisterDto {
  email: string;
  password?: string;
  isBusiness: boolean;
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  openingTime?: string;
  closingTime?: string;
  workingDays?: string;
  isOpen24Hours?: boolean;
}

export interface LoginDto {
  email: string;
  password: string;
}

class AuthService {
  private readonly saltRounds = 10;

  public async register(dto: RegisterDto): Promise<string | null> {
    const { email, password, isBusiness, ...businessData } = dto;
    logger.info('[AuthService] Registering user with email:', email);

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new HttpError('User already exists with this email', 409);
    }

    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, this.saltRounds);
    } else if (!isBusiness) {
      throw new HttpError('Password is required for staff accounts', 400);
    }

    const role = isBusiness ? 'ADMIN' : 'STAFF';

    try {
      const newUser = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, role, passwordHash: hashedPassword },
        });

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
              openingTime: businessData.openingTime ?? null,
              closingTime: businessData.closingTime ?? null,
              workingDays: businessData.workingDays ?? null,
              isOpen24Hours: businessData.isOpen24Hours ?? false,
              status: 'PENDING',
              userId: user.userId,
            },
          });
        }
        return user;
      });

      if (isBusiness) return null;
      return this.generateToken(newUser);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if ((error as any).code === 'P2003') {
        throw new HttpError('Invalid input data provided for registration', 400);
      }
      logger.error('Registration error:', error);
      throw new HttpError('Registration failed due to server error', 500);
    }
  }

  public async login(dto: LoginDto): Promise<string> {
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

    if (!user) throw new HttpError('Invalid credentials', 401);

    if (user.role === 'ADMIN' && user.business) {
      if (user.business.status === 'PENDING') {
        throw new HttpError('Your account is pending approval. You will be notified via email once approved.', 403);
      }
      if (user.business.status === 'REJECTED') {
        throw new HttpError('Your account application has been rejected.', 403);
      }
    }

    if (!user.passwordHash) {
      throw new HttpError('Please set your password via the link sent to your email.', 401);
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new HttpError('Invalid credentials', 401);

    return this.generateToken(user);
  }

  private generateToken(user: Pick<User, 'userId' | 'email' | 'role'>): string {
    const payload: JwtPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  public async requestPasswordReset(email: string): Promise<void> {
    const user = await db.user.findUnique({ where: { email }, select: { userId: true, email: true } });
    if (!user) return;
    const token = jwt.sign({ type: 'reset', userId: user.userId, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    const resetUrl = `${FRONTEND_BASE_URL}/auth/reset?token=${encodeURIComponent(token)}`;
    await emailService.sendPasswordReset(user.email, resetUrl);
    logger.info('[Auth] Sent password reset email to', user.email);
  }

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
