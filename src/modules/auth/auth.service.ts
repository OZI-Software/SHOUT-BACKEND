import { db } from '../../core/db/prisma.js';
import { UserRole, BusinessStatus, type User, Prisma } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import type { JwtPayload } from '../../config/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, FRONTEND_BASE_URL } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';
import { emailService } from '../../core/email/email.service.js';

export interface RegisterDto {
  email: string;
  name?: string;
  password?: string;
  isBusiness: boolean;
  businessName?: string;
  description?: string;
  address?: string;
  pinCode?: number;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  abcCode?: string;
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

  public async sendOtp(email: string, mobileNumber?: string): Promise<void> {
    // Check if user already exists
    const existingUserByEmail = await db.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      throw new HttpError('User already exists with this email', 409);
    }

    if (mobileNumber) {
      const existingUserByMobile = await db.user.findUnique({ where: { mobileNumber } });
      if (existingUserByMobile) {
        throw new HttpError('User already exists with this mobile number', 409);
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in DB (upsert)
    const existing = await db.otpVerification.findFirst({ where: { email } });
    if (existing) {
      await db.otpVerification.update({
        where: { id: existing.id },
        data: { otp, expiresAt },
      });
    } else {
      await db.otpVerification.create({
        data: { email, otp, expiresAt },
      });
    }

    // Send email
    await emailService.sendOtp(email, otp);
    logger.info('[AuthService] Sent OTP to:', email);
  }

  public async register(dto: RegisterDto & { mobileNumber?: string, otp?: string }): Promise<string | null> {
    const { email, mobileNumber, password, isBusiness, abcCode, name, otp, ...businessData } = dto;
    logger.info('[AuthService] Registering user:', { email, mobileNumber, isBusiness });

    // Email is strictly required for everyone now (as per requirement)
    if (!email) {
      throw new HttpError('Email is required', 400);
    }

    if (email) {
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) throw new HttpError('User already exists with this email', 409);
    }

    if (mobileNumber) {
      const existingUser = await db.user.findUnique({ where: { mobileNumber } });
      if (existingUser) throw new HttpError('User already exists with this mobile number', 409);
    }

    // OTP Verification for Customers
    if (!isBusiness) {
      if (!otp) throw new HttpError('OTP is required for customer registration', 400);

      const verification = await db.otpVerification.findFirst({ where: { email } });
      if (!verification || verification.otp !== otp) {
        throw new HttpError('Invalid OTP', 400);
      }
      if (verification.expiresAt < new Date()) {
        throw new HttpError('OTP has expired. Please request a new one.', 400);
      }

      // Cleanup OTP
      await db.otpVerification.delete({ where: { id: verification.id } });
    }

    let hashedPassword: string | null = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, this.saltRounds);
    } else if (!isBusiness) {
      throw new HttpError('Password is required for customer accounts', 400);
    }

    if (!isBusiness) {
      if (!name) throw new HttpError('Name is required for customer accounts', 400);
      if (!mobileNumber) throw new HttpError('Mobile number is required for customer accounts', 400);
      if (!/^\d{10}$/.test(mobileNumber)) throw new HttpError('Mobile number must be 10 digits', 400);
    }

    // Default to CUSTOMER if not business
    const role: UserRole = isBusiness ? UserRole.ADMIN : UserRole.CUSTOMER;

    try {
      const newUser = await db.$transaction(async (tx) => {
        const userData: Prisma.UserCreateInput = {
          email,
          mobileNumber: mobileNumber ?? null,
          role,
          passwordHash: hashedPassword,
          name: name ?? null,
        };

        const user = await tx.user.create({
          data: userData,
        });

        if (isBusiness) {
          if (!abcCode) {
            throw new HttpError('ABC Code is required for business registration', 400);
          }
          logger.info('[AuthService] Creating business profile for user:', user.userId);
          const missing: string[] = [];
          if (!businessData.businessName) missing.push('businessName');
          if (!businessData.description) missing.push('description');
          if (!businessData.address) missing.push('address');
          if (!businessData.pinCode) missing.push('pinCode');
          if (!businessData.latitude) missing.push('latitude');
          if (!businessData.longitude) missing.push('longitude');
          if (!businessData.googleMapsLink) missing.push('googleMapsLink');
          // Timings are required unless explicitly open 24 hours
          const is24 = !!businessData.isOpen24Hours;
          if (!is24) {
            if (!businessData.openingTime) missing.push('openingTime');
            if (!businessData.closingTime) missing.push('closingTime');
            if (!businessData.workingDays) missing.push('workingDays');
          }
          if (missing.length > 0) {
            throw new HttpError(`Missing required business fields: ${missing.join(', ')}`, 400);
          }

          // Validate time format (HH:MM) when not 24 hours
          if (!is24) {
            const re = /^([0-1]\d|2[0-3]):[0-5]\d$/;
            const open = String(businessData.openingTime);
            const close = String(businessData.closingTime);
            if (!re.test(open) || !re.test(close)) {
              throw new HttpError('Opening and closing times must be in HH:MM format', 400);
            }
            if (open >= close) {
              throw new HttpError('Closing time must be later than opening time', 400);
            }
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
              status: BusinessStatus.PENDING,
              userId: user.userId,
              abcCode: abcCode ?? null,
              // Business timings
              isOpen24Hours: is24,
              openingTime: is24 ? null : String(businessData.openingTime),
              closingTime: is24 ? null : String(businessData.closingTime),
              workingDays: is24 ? null : String(businessData.workingDays),
            } as Prisma.BusinessUncheckedCreateInput,
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
      // Surface Prisma error codes to aid debugging schema mismatches
      const code = (error as any)?.code;
      const msg = (error as any)?.message || 'Registration failed due to server error';
      logger.error('Registration error:', error);
      throw new HttpError(code ? `${msg} (code ${code})` : msg, 500);
    }
  }

  public async login(dto: LoginDto & { mobileNumber?: string }): Promise<string> {
    // Allow login with email OR mobileNumber (passed as email field or separate field)
    // For simplicity, let's assume the frontend sends 'email' field which can be email or mobile
    const identifier = dto.email;

    let user = await db.user.findUnique({
      where: { email: identifier },
      select: {
        userId: true,
        email: true,
        role: true,
        passwordHash: true,
        business: { select: { status: true } }
      },
    });

    if (!user) {
      // Try finding by mobile number
      user = await db.user.findUnique({
        where: { mobileNumber: identifier },
        select: {
          userId: true,
          email: true,
          role: true,
          passwordHash: true,
          business: { select: { status: true } }
        },
      });
    }

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

  private generateToken(user: Pick<User, 'userId' | 'role'> & { email: string | null }): string {
    const payload: JwtPayload = {
      userId: user.userId,
      email: user.email ?? '',
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  public async requestPasswordReset(email: string): Promise<void> {
    const user = await db.user.findUnique({ where: { email }, select: { userId: true, email: true } });
    if (!user || !user.email) return;
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
