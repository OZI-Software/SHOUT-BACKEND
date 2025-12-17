import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'superadmin@shout.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: { role: UserRole.SUPER_ADMIN }, // Ensure role is SUPER_ADMIN if exists
        create: {
            email,
            passwordHash: hashedPassword,
            role: UserRole.SUPER_ADMIN,
        },
    });

    console.log('Super Admin user seeded:', user.email);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
