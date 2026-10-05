import { ForbiddenException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, setup } from './index.mocks';

function base() {
  return {
    accessibleOwners: mocks.accessibleOwners,
    description: '  Rice ',
    owner: OwnerType.USER,
    ownerId: 'user-id',
    quantity: 2,
    unit: StockUnits.KILOGRAM,
  };
}

it('SHOULD create the item with trimmed text AND return the entity', async () => {
  const result = await setup.execute({ ...base(), expirationDate: '2027-03-01T00:00:00.000Z' });

  expect(mocks.stockRepository.create).toHaveBeenCalledWith({
    description: 'Rice',
    expirationDate: new Date('2027-03-01T00:00:00.000Z'),
    owner: OwnerType.USER,
    ownerId: 'user-id',
    quantity: 2,
    unit: StockUnits.KILOGRAM,
  });
  expect(result).toBe(mocks.created);
});

it('SHOULD allow quantity 0 AND 1,000,000', async () => {
  await setup.execute({ ...base(), quantity: 0 });
  await setup.execute({ ...base(), quantity: 1_000_000 });

  expect(mocks.stockRepository.create).toHaveBeenCalledTimes(2);
});

it('SHOULD store empty strings and null as absent', async () => {
  await setup.execute({ ...base(), barcode: '', brand: '   ', notes: '', openingDate: null });

  const [call] = mocks.stockRepository.create.mock.calls[0];
  expect(call.barcode).toBeUndefined();
  expect(call.brand).toBeUndefined();
  expect(call.notes).toBeUndefined();
  expect(call.openingDate).toBeUndefined();
});

it('SHOULD allow creating in a family the caller belongs to', async () => {
  await setup.execute({ ...base(), owner: OwnerType.FAMILY, ownerId: 'family-id' });

  expect(mocks.stockRepository.create).toHaveBeenCalled();
});

it.each([
  ['another user', { owner: OwnerType.USER, ownerId: 'other-user' }],
  ['a family the caller is not in', { owner: OwnerType.FAMILY, ownerId: 'other-family' }],
  ['a family id under the USER type', { owner: OwnerType.USER, ownerId: 'family-id' }],
])('SHOULD throw Forbidden (403) AND store nothing WHEN the owner is %s', async (_label, owner) => {
  await expect(setup.execute({ ...base(), ...owner })).rejects.toThrow(ForbiddenException);
  expect(mocks.stockRepository.create).not.toHaveBeenCalled();
});

it.each([
  ['a missing description', { description: undefined }],
  ['a whitespace-only description', { description: '   ' }],
  ['a 201-char description', { description: 'a'.repeat(201) }],
  ['a negative quantity', { quantity: -1 }],
  ['a fractional quantity', { quantity: 1.5 }],
  ['a quantity above 1,000,000', { quantity: 1_000_001 }],
  ['a string quantity', { quantity: '2' }],
  ['an unknown unit', { unit: 'pound' }],
  ['a 101-char brand', { brand: 'a'.repeat(101) }],
  ['a 65-char barcode', { barcode: 'a'.repeat(65) }],
  ['1001-char notes', { notes: 'a'.repeat(1001) }],
  ['a date without time', { purchaseDate: '2026-10-04' }],
  ['an impossible calendar date', { purchaseDate: '2026-02-30T00:00:00.000Z' }],
  ['year 0000', { expirationDate: '0000-01-01T00:00:00.000Z' }],
])('SHOULD throw ValidationError AND store nothing WHEN there is %s', async (_label, patch) => {
  await expect(setup.execute({ ...base(), ...patch } as never)).rejects.toThrow(ValidationError);
  expect(mocks.stockRepository.create).not.toHaveBeenCalled();
});
