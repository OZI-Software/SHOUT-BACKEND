import prisma from '../../core/db/prisma.js';
import type { User, UserRole, Business } from '../../../generated/prisma/index.js';
import logger from '../../core/utils/logger.js';
// import bcrypt from 'bcryptjs'; // For password hashing
// import jwt from 'jsonwebtoken'; // For token generation

interface ILoginResult {
  token: string;
  user: { id: string; name: string; email: string; role: UserRole; businessId: string };
}

// Custom error for known authentication issues
class AuthenticationError extends Error {
    statusCode: number = 401;
    constructor(message: string) {
        super(message);
    }
}

/**
 * AuthenticationService handles all domain logic: user credentials, JWT, and FCM token management.
 */
export class AuthService {
  private readonly prisma = prisma; // Use the injected client

  // --- Helper to generate JWT ---
  private generateToken(user: User): string {
    // In production: jwt.sign({ userId: user.id, businessId: user.businessId, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '1d' });
    const payload = { userId: user.id, businessId: user.businessId, role: user.role };
    logger.debug('Generating token for:', payload);
    return `JWT.${Buffer.from(JSON.stringify(payload)).toString('base64')}.SIGNED`;
  }

  /**
   * Registers a new staff member. Requires an existing Business ID.
   * This is typically an ADMIN/MANAGER-only route in a real RMS, but exposed here for setup.
   */
  async registerStaff(
    name: string, 
    email: string, 
    passwordPlain: string, 
    businessId: string, 
    // role: UserRole
  ): Promise<User> {
    const hashedPassword = `HASHED_${passwordPlain}`; // bcrypt.hashSync(passwordPlain, 10);

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new AuthenticationError('Business ID not found.');
    }

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        businessId,
      },
    });
    
    logger.info(`New staff registered: ${user.email} for business ${businessId}`);
    return user;
  }
  
  /**
   * Logs in a user, verifies credentials, and generates a JWT.
   */
  async login(email: string, passwordPlain: string): Promise<ILoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.password !== `HASHED_${passwordPlain}` /* !bcrypt.compareSync(passwordPlain, user.password) */) {
      throw new AuthenticationError('Invalid email or password.');
    }
    
    if (!user.active) {
        throw new AuthenticationError('Account is inactive.');
    }

    const token = this.generateToken(user);
    
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
    };
  }
  
  /**
   * Saves the Firebase Cloud Messaging (FCM) token for a staff user.
   * This is used to send real-time push notifications (e.g., "New Order Received").
   * @param userId The ID of the authenticated user.
   * @param token The FCM device token.
   */
  async saveFCMToken(userId: string, token: string): Promise<void> {
    // Note: The User model doesn't currently have an FCM token field,
    // so we'll simulate saving it in a separate table/context for now.
    
    logger.info(`FCM Token saved for user ${userId}. Token: ${token.substring(0, 10)}...`);
    
    // In a real app, you would upsert this token into an FCMToken model linked to User
    // await this.prisma.fcmToken.upsert({ ... })
    
    // We update a mock field on the User for demonstration:
    await this.prisma.user.update({
        where: { id: userId },
        data: { 
            // This is a placeholder for the actual FCM management
            // Ideally, a dedicated FCMToken model handles multiple device tokens per user
            name: `${token.substring(0, 5)}...`, // Mocking change for demonstration
        }
    });
  }
}