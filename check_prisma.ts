
import { Prisma } from '@prisma/client';

const userModel = Prisma.dmmf.datamodel.models.find(m => m.name === 'User');
if (userModel) {
    console.log(JSON.stringify(userModel.fields.map(f => f.name), null, 2));
} else {
    console.log('User model not found');
}
