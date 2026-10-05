import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { INT4_MAX } from '@finance/application/dto/FinanceCommon';
import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

async function run(patch: Record<string, unknown>) {
  return setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.transaction.id,
    ...patch,
  } as never);
}

it('SHOULD validate the RESULTING record (patch merged over the stored one) AND update only the sent fields', async () => {
  const result = await run({ description: ' Updated ', value: 100 });

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    accountId: mocks.transaction.accountId,
    categoryId: mocks.transaction.categoryId,
    owner: mocks.transaction.owner,
    ownerId: mocks.transaction.ownerId,
    type: mocks.transaction.type,
  });
  expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith({
    accountId: undefined,
    categoryId: undefined,
    date: undefined,
    description: 'Updated',
    id: mocks.transaction.id,
    owner: undefined,
    ownerId: undefined,
    type: undefined,
    value: 100,
  });
  expect(result).toBe(mocks.updated);
});

it('SHOULD check a new account / category / type against the stored owner', async () => {
  await run({
    accountId: 'new-account',
    categoryId: 'new-category',
    type: TransactionType.INCOME,
  });

  expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'new-account',
      categoryId: 'new-category',
      ownerId: mocks.transaction.ownerId,
      type: TransactionType.INCOME,
    }),
  );
});

describe('changing the owner', () => {
  const move = {
    accountId: 'family-account',
    categoryId: 'family-category',
    owner: OwnerType.FAMILY,
    ownerId: 'family-id',
  };

  it('SHOULD check the new account and category against the NEW owner', async () => {
    await run(move);

    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(expect.objectContaining(move));
    expect(mocks.transactionRepository.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ owner: OwnerType.FAMILY, ownerId: 'family-id' }),
    );
  });

  it('SHOULD reject (400 from the consistency check) a move WHEN the account / category stay with the old owner', async () => {
    mocks.ensureConsistency.execute.mockRejectedValueOnce(new BadRequestException());

    await expect(run({ owner: OwnerType.FAMILY, ownerId: 'family-id' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.ensureConsistency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: mocks.transaction.accountId,
        owner: OwnerType.FAMILY,
        ownerId: 'family-id',
      }),
    );
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });

  it('SHOULD throw Forbidden (403) WHEN the new owner is not accessible', async () => {
    await expect(run({ ...move, ownerId: 'someone-elses-family' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(mocks.ensureConsistency.execute).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  });
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.transaction, ownerId: 'stranger' }],
])(
  'SHOULD throw NotFound (404) AND update nothing WHEN the transaction is %s',
  async (_label, found) => {
    mocks.transactionRepository.findTransactionById.mockResolvedValueOnce(found);

    await expect(run({ value: 1 })).rejects.toThrow(NotFoundException);
    expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
  },
);

it.each([
  ['an empty patch', {}],
  ['value 0', { value: 0 }],
  ['a fractional value', { value: 1.5 }],
  ['a value above int4', { value: INT4_MAX + 1 }],
  ['an impossible date', { date: '2026-04-31' }],
  ['a whitespace-only description', { description: '   ' }],
  ['null on a required field', { description: null }],
])('SHOULD throw ValidationError WHEN the patch is %s', async (_label, patch) => {
  await expect(run(patch)).rejects.toThrow(ValidationError);
  expect(mocks.transactionRepository.updateTransaction).not.toHaveBeenCalled();
});
