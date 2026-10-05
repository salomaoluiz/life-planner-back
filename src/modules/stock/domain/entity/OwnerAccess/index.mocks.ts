import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

const userAccess = { owner: OwnerType.USER, ownerId: 'user-id' };
const familyAccess = { owner: OwnerType.FAMILY, ownerId: 'family-id' };

export const mocks = { accessible: [userAccess, familyAccess], familyAccess, userAccess };
