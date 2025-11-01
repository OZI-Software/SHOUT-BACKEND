import { db } from '../../core/db/prisma.js';
import type { User } from '../../../generated/prisma/client.js';
import { HttpError } from '../../config/index.js';
import { logger } from '../../core/utils/logger.js';    

/**
 * Handles database operations related to the User model.
 */
class UserService {
  // Example: Find a user by ID
  public async findUserById(userId: string): Promise<User> {
    const user = await db.user.findUnique({
      where: { userId },
      select: { userId: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new HttpError('User not found', 404);
    }
    return user;
  }

  // Add more methods: createUser, updateUser, deleteUser, etc.
}

export const userService = new UserService();