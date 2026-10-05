import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { TransactionController } from './transaction.controller';
import { mocks, setup } from './transaction.controller.mocks';

const validBody = {
  accountId: '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10',
  categoryId: '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607',
  date: '2026-10-03',
  description: 'Weekly groceries',
  owner: 'USER',
  ownerId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d',
  type: 'EXPENSE',
  value: 23490,
};

it('SHOULD be served at /finance/transactions under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, TransactionController)).toBe('finance/transactions');
  expect(Reflect.getMetadata(VERSION_METADATA, TransactionController)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD list without filters, or with repeated ownerId params', async () => {
    await setup.findAll(mocks.request, {});
    await setup.findAll(mocks.request, { ownerId: [validBody.ownerId, validBody.accountId] });

    expect(mocks.transactionService.findAll).toHaveBeenNthCalledWith(
      1,
      mocks.request.user.id,
      undefined,
    );
    expect(mocks.transactionService.findAll).toHaveBeenNthCalledWith(2, mocks.request.user.id, [
      validBody.ownerId,
      validBody.accountId,
    ]);
  });

  it('SHOULD throw ValidationError WHEN an ownerId is not a uuid', async () => {
    await expect(setup.findAll(mocks.request, { ownerId: ['abc'] })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, validBody as never);

    expect(mocks.transactionService.create).toHaveBeenCalledWith(mocks.request.user.id, validBody);
    expect(result).toEqual(mocks.transaction);
  });

  it.each([
    ['value 12.5', { value: 12.5 }],
    ['value 0', { value: 0 }],
    ['value -100', { value: -100 }],
    ['an impossible date', { date: '2026-02-30' }],
    ['an ISO timestamp date', { date: '2026-10-03T10:00:00Z' }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, patch) => {
    await expect(setup.create(mocks.request, { ...validBody, ...patch } as never)).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.transactionService.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('SHOULD forward a valid patch', async () => {
    await setup.update(mocks.request, mocks.transaction.id, { value: 100 } as never);

    expect(mocks.transactionService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
      { value: 100 },
    );
  });

  it('SHOULD throw ValidationError (400) WHEN the body is empty', async () => {
    await expect(setup.update(mocks.request, mocks.transaction.id, {} as never)).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.transactionService.update).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('SHOULD delete by id AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.transaction.id);

    expect(mocks.transactionService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.transaction.id,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, TransactionController.prototype.delete)).toBe(
      204,
    );
  });
});
