import { db } from '../../core/db/prisma.js';
import type { User } from '@prisma/client';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';

/**
 * Handles database operations related to the User model.
 */
class UserService {
  // Example: Find a user by ID
  public async findUserById(userId: string): Promise<PublicUser> {
    const user = await db.user.findUnique({
      where: { userId },
      select: { userId: true, email: true, role: true, createdAt: true, name: true, mobileNumber: true },
    });

    if (!user) {
      throw new HttpError('User not found', 404);
    }
    return user;
  }

  // Find all users (for admin listing) with stats
  public async findAll(): Promise<any[]> {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        email: true,
        role: true,
        createdAt: true,
        name: true,
        mobileNumber: true,
        // Activity stats
        _count: {
          select: {
            favorites: true,
            acceptances: true,
            createdOffers: true
          }
        },
        // Business details if they are admins
        business: {
          select: {
            businessName: true
          }
        },
        adminForBusiness: {
          select: {
            businessName: true
          }
        }
      },
    });

    return users.map(user => ({
      ...user,
      favoritesCount: user._count.favorites,
      acceptancesCount: user._count.acceptances,
      createdOffersCount: user._count.createdOffers,
      businessName: user.business?.businessName || user.adminForBusiness?.businessName || null
    }));
  }

  // Add more methods: createUser, updateUser, deleteUser, etc.
}

export const userService = new UserService();

// Safe, public-facing user shape (no password hash or sensitive fields)
export type PublicUser = Pick<User, 'userId' | 'email' | 'role' | 'createdAt' | 'name' | 'mobileNumber'>;