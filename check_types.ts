
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'node_modules/.prisma/client/index.d.ts');
try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const start = content.indexOf('type UserCreateInput = {');
    if (start !== -1) {
        const end = content.indexOf('}', start);
        const block = content.substring(start, end + 1);
        if (block.includes('name?: string | null')) {
            console.log('Found name field in UserCreateInput!');
        } else {
            console.log('Name field NOT found in UserCreateInput');
            console.log(block);
        }
    } else {
        console.log('UserCreateInput not found');
    }
} catch (e) {
    console.error(e);
}
