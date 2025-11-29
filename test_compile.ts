
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.user.create({
        data: {
            email: 'test@test.com',
            name: 'Test',
        }
    });
}
