import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { base, mocks, setup } from './index.mocks';

it('SHOULD ensure the default first AND create the list (BRL, not default)', async () => {
  await setup.execute({ ...base, language: 'en-US' });

  expect(mocks.lists.ensureDefault).toHaveBeenCalledWith(
    { owner: 'USER', ownerId: 'user-id' },
    'Groceries',
  );
  expect(mocks.lists.create).toHaveBeenCalledWith({
    currency: 'BRL',
    isDefault: false,
    name: 'Pharmacy',
    owner: 'USER',
    ownerId: 'user-id',
  });
});

it('SHOULD answer 409 WHEN the name exists among the owner lists (case-insensitive)', async () => {
  await expect(setup.execute({ ...base, name: 'mercado' })).rejects.toThrow(ConflictException);
  expect(mocks.lists.create).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an owner the caller cannot reach AND 422 for an archived family', async () => {
  await expect(setup.execute({ ...base, ownerId: 'other' })).rejects.toThrow(NotFoundException);
  await expect(
    setup.execute({
      ...base,
      accessibleOwners: mocks.archivedOwners,
      owner: OwnerType.FAMILY,
      ownerId: 'family-id',
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});
