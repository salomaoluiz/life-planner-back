import { ConflictException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { category } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  language: 'pt-BR' as const,
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

it('SHOULD create the nine defaults in the requested language, unmapped', async () => {
  await setup.execute(input);

  const created = mocks.catalog.createCategories.mock.calls[0][0];

  expect(created).toHaveLength(9);
  expect(created[0]).toEqual({ name: 'Mercearia', owner: 'USER', ownerId: 'user-id' });
});

it('SHOULD use English names for en-US', async () => {
  await setup.execute({ ...input, language: 'en-US' });

  expect(mocks.catalog.createCategories.mock.calls[0][0][0].name).toBe('Groceries');
});

it('SHOULD answer 409 WHEN the owner already has categories (the second call)', async () => {
  mocks.catalog.findCategories.mockResolvedValue([category('a')]);

  await expect(setup.execute(input)).rejects.toThrow(ConflictException);
  expect(mocks.catalog.createCategories).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an owner the caller cannot reach', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
});
