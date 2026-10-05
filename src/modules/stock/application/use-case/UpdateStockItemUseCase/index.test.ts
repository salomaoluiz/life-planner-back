import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

function base() {
  return { accessibleOwners: mocks.accessibleOwners, id: mocks.item.id };
}

it('SHOULD update only the sent fields AND return the entity', async () => {
  const result = await setup.execute({
    ...base(),
    openingDate: '2026-10-04T08:00:00.000Z',
    quantity: 1,
  });

  expect(mocks.stockRepository.update).toHaveBeenCalledWith({
    id: mocks.item.id,
    openingDate: new Date('2026-10-04T08:00:00.000Z'),
    quantity: 1,
  });
  expect(result).toBe(mocks.updated);
});

it('SHOULD clear optional fields WHEN null or empty string is sent', async () => {
  await setup.execute({ ...base(), brand: '', expirationDate: null, notes: null });

  const [call] = mocks.stockRepository.update.mock.calls[0];
  expect(call.notes).toBeNull();
  expect(call.brand).toBeNull();
  expect(call.expirationDate).toBeNull();
});

it('SHOULD move the item WHEN the caller can access both owners', async () => {
  await setup.execute({ ...base(), owner: OwnerType.FAMILY, ownerId: 'family-id' });

  expect(mocks.stockRepository.update).toHaveBeenCalledWith(
    expect.objectContaining({ owner: OwnerType.FAMILY, ownerId: 'family-id' }),
  );
});

it('SHOULD accept "moving" to the owner the item already has', async () => {
  await setup.execute({ ...base(), owner: OwnerType.USER, ownerId: 'user-id' });

  expect(mocks.stockRepository.update).toHaveBeenCalled();
});

it('SHOULD throw Forbidden (403) AND change nothing WHEN moving to an owner without access', async () => {
  await expect(
    setup.execute({ ...base(), owner: OwnerType.FAMILY, ownerId: 'other-family' }),
  ).rejects.toThrow(ForbiddenException);
  expect(mocks.stockRepository.update).not.toHaveBeenCalled();
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.item, ownerId: 'someone-else' }],
])('SHOULD throw NotFound (404) AND change nothing WHEN the item is %s', async (_label, found) => {
  mocks.stockRepository.findById.mockResolvedValueOnce(found);

  await expect(setup.execute({ ...base(), quantity: 1 })).rejects.toThrow(NotFoundException);
  expect(mocks.stockRepository.update).not.toHaveBeenCalled();
});

it('SHOULD answer 404 (not 403) WHEN the current owner is inaccessible even if the target is accessible', async () => {
  mocks.stockRepository.findById.mockResolvedValueOnce({ ...mocks.item, ownerId: 'someone-else' });

  await expect(
    setup.execute({ ...base(), owner: OwnerType.USER, ownerId: 'user-id' }),
  ).rejects.toThrow(NotFoundException);
});

it.each([
  ['an empty patch', {}],
  ['only owner', { owner: OwnerType.FAMILY }],
  ['only ownerId', { ownerId: 'family-id' }],
  ['null description', { description: null }],
  ['null quantity', { quantity: null }],
  ['null unit', { unit: null }],
  ['a negative quantity', { quantity: -1 }],
  ['a fractional quantity', { quantity: 0.5 }],
  ['quantity above 1,000,000', { quantity: 1_000_001 }],
  ['a whitespace-only description', { description: '  ' }],
  ['year 0000', { openingDate: '0000-01-01T00:00:00.000Z' }],
])(
  'SHOULD throw ValidationError AND change nothing WHEN the patch is %s',
  async (_label, patch) => {
    await expect(setup.execute({ ...base(), ...patch } as never)).rejects.toThrow(ValidationError);
    expect(mocks.stockRepository.update).not.toHaveBeenCalled();
  },
);
