import { faker } from '@faker-js/faker';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const otherFamilyId = faker.string.uuid();

const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];

// endregion Mocks

const mocks = { accessibleOwners, familyId, otherFamilyId, userId };
const spies = {};

export { mocks, spies };
