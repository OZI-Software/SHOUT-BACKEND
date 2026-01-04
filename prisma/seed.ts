import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const users = [
        {
            email: 'admin@shout.com',
            role: UserRole.SUPER_ADMIN,
        },
        {
            email: 's.sreedhargoud@gmail.com',
            role: UserRole.CUSTOMER,
        },
    ];

    for (const u of users) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                role: u.role,
                passwordHash: hashedPassword // Update password just in case
            },
            create: {
                email: u.email,
                passwordHash: hashedPassword,
                role: u.role,
            },
        });
        console.log(`Seeded user: ${user.email} with role ${user.role}`);
    }
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
