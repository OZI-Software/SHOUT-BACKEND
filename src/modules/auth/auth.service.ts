import { db } from '../../core/db/prisma.js';
import { userRole } from '@prisma/client';
import type {User} from '@prisma/client';
import { HttpError} from '../../config/index.js';
import type {JwtPayload } from '../../config/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/index.d.js';
import { logger } from '../../core/utils/logger.js';

// Define DTOs (Data Transfer Objects) for better type safety
interface RegisterDto {
  email: string;
  password: string; // Required for User
  isBusiness: boolean; // Flag to indicate business registration

  // Business fields (only required if isBusiness is true)
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
   * This handles the simultaneous signup and business registration.
   */
  public async register(dto: RegisterDto): Promise<string> {
    const { email, password, isBusiness, ...businessData } = dto;

    // --- SECURITY NOTE ---
    // Your current Prisma schema for 'User' does NOT include a field for password.
    // In a real application, you MUST add a `passwordHash: String` field to the User model
    // to securely store the hashed password for login verification.
    // The code below assumes such a field exists or is handled separately.
    // logger.info("[AuthService] Business Data is");
    logger.info('[AuthService] Registering user with email:', email, businessData.description, businessData.address, businessData.pinCode, businessData.latitude, businessData.longitude);

    // 1. Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new HttpError('User already exists with this email', 409);
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    const role = isBusiness ? userRole.ADMIN : userRole.STAFF; 

    // 3. Perform registration in a database transaction
    try {
      const newUser = await db.$transaction(async (tx) => {
        
        // --- Step 3a: Create User ---
        const user = await tx.user.create({
          data: {
            email,
            role,
            // Assume `passwordHash` is added to the User model
            // passwordHash: hashedPassword, 
          },
        });

        // --- Step 3b: Create Business if requested ---
        logger.info('[AuthService] Creating business profile for user:', user.userId);
        if (isBusiness) {
          if (!businessData.businessName || !businessData.address || !businessData.latitude || !businessData.longitude || !businessData.description || !businessData.pinCode) {
            // Throw a 400 error if key business fields are missing
            throw new HttpError('Missing required business fields (name, address, location) for business registration', 400);
          }
          logger.info('[AuthService] Business profile created successfully for user:', user.userId);
          await tx.business.create({
            data: {
              businessName: businessData.businessName,
              description: businessData.description,
              address: businessData.address,
              pinCode: Number(businessData.pinCode),
              latitude: Number(businessData.latitude), 
              longitude: Number(businessData.longitude),
              userId: user.userId,
            },
          });
        }
        return user;
      });

      // 4. Generate JWT
      return this.generateToken(newUser);
    } catch (error) {
      // Catch HttpErrors thrown within the transaction
      if (error instanceof HttpError) throw error; 
      
      // Handle Prisma errors (e.g., if a relation fails)
      if ((error as any).code === 'P2003') { 
         throw new HttpError('Invalid input data provided for registration', 400);
      }
      throw new HttpError('Registration failed due to server error', 500);
    }
  }
  
  // (The rest of the AuthService, including login and generateToken, remains the same)

  /**
   * Authenticates a user and returns a JWT.
   */
  public async login(dto: LoginDto): Promise<string> {
    // 1. Find user by email (include password hash in a real setup)
    const user = await db.user.findUnique({
      where: { email: dto.email },
      // NOTE: Must select the hashed password field here in a real app.
      // select: { userId: true, email: true, role: true, passwordHash: true } 
    });

    if (!user) {
      throw new HttpError('Invalid credentials', 401);
    }

    // 2. Compare password 
    // const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    const isMatch = true; // ⚠️ Placeholder for actual password check ⚠️

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
}

export const authService = new AuthService();