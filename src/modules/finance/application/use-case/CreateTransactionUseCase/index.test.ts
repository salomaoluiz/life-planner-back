import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD check consistency, then create the transaction with integer cents AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.input.accessibleOwners,
    accountId: mocks.input.accountId,
    categoryId: mocks.input.categoryId,
    owner: mocks.input.owner,
    ownerId: mocks.input.ownerId,
    type: mocks.input.type,
  });
  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith({
    accountId: mocks.input.accountId,
    categoryId: mocks.input.categoryId,
    date: '2026-10-03',
    description: 'Weekly groceries',
    owner: OwnerType.USER,
    ownerId: mocks.input.ownerId,
    type: mocks.input.type,
    value: 23490,
  });
  expect(result).toBe(mocks.transaction);
});

it('SHOULD trim the description AND accept the maximum value', async () => {
  await setup.execute({ ...mocks.input, description: '  Lunch ', value: INT4_MAX });

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Lunch', value: INT4_MAX }),
  );
});

it('SHOULD throw Forbidden (403) BEFORE any lookup WHEN the owner is not accessible', async () => {
  await expect(
    setup.execute({ ...mocks.input, owner: OwnerType.FAMILY, ownerId: 'pending-invite-family' }),
  ).rejects.toThrow(ForbiddenException);
  expect(mocks.ensureConsistency.execute).not.toHaveBeenCalled();
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['NotFound (account / category missing)', new NotFoundException()],
  ['BadRequest (owner or type mismatch)', new BadRequestException()],
])('SHOULD create nothing WHEN the consistency check throws %s', async (_label, error) => {
  mocks.ensureConsistency.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it.each([
  ['a fractional value', { value: 12.5 }],
  ['zero', { value: 0 }],
  ['a negative value', { value: -100 }],
  ['a value above int4', { value: INT4_MAX + 1 }],
  ['a string value', { value: '100' }],
  ['an empty description', { description: '  ' }],
  ['a 201-character description', { description: 'a'.repeat(201) }],
  ['an impossible date', { date: '2026-02-30' }],
  ['month 13', { date: '2026-13-01' }],
  ['a date without zero padding', { date: '2026-10-3' }],
  ['an ISO timestamp', { date: '2026-10-03T10:00:00.000Z' }],
  ['a Date-like number', { date: 20261003 }],
  ['an unknown type', { type: 'TRANSFER' }],
])('SHOULD throw ValidationError WHEN the input has %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.transactionRepository.createTransaction).not.toHaveBeenCalled();
});

it('SHOULD accept a leap day', async () => {
  await setup.execute({ ...mocks.input, date: '2024-02-29' });

  expect(mocks.transactionRepository.createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({ date: '2024-02-29' }),
  );
});
