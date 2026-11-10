import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentFeeKind } from '@investment/domain/enum';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.operation.id };
const linked = operationFixture({
  accountId: 'acc-1',
  assetId: mocks.asset.id,
  fees: [{ amount: 490, description: null, id: 'f1', kind: InvestmentFeeKind.BROKERAGE }],
  generateTransaction: true,
  id: 'op-linked',
  transactionId: 'tx-1',
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-09T12:00:00Z'));
  spies.findOperationById.mockResolvedValue(linked);
  spies.findAssetById.mockResolvedValue({ ...mocks.detail, operations: [linked] });
  spies.findAccountForOperation.mockResolvedValue(mocks.account);
  spies.writeOperation.mockResolvedValue('op-linked');
});

afterEach(() => jest.useRealTimers());

it('SHOULD keep what is not sent: fees, account, type AND recompute the totals', async () => {
  await setup.execute({ ...base, unitPrice: '11' });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      fees: [{ amount: 490, description: null, kind: 'BROKERAGE' }],
      feesTotal: 490,
      generateTransaction: true,
      gross: 550000,
      operationId: 'op-linked',
      total: 550490,
      type: 'BUY',
    }),
  );
});

it('SHOULD change date, quantity, fees AND the account', async () => {
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, id: 'acc-2' });

  await setup.execute({
    ...base,
    accountId: 'acc-2',
    date: '2026-06-01',
    fees: [],
    quantity: '400',
  });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-2',
      date: '2026-06-01',
      feesTotal: 0,
      gross: 408000,
    }),
  );
});

it('SHOULD drop the account WHEN generateTransaction is turned off', async () => {
  await setup.execute({ ...base, generateTransaction: false });

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: null, generateTransaction: false }),
  );
});

it('SHOULD ask for an account WHEN turning generateTransaction on without one', async () => {
  const unlinked = operationFixture({ assetId: mocks.asset.id, id: 'op-unlinked' });
  spies.findOperationById.mockResolvedValue(unlinked);

  await expect(setup.execute({ ...base, generateTransaction: true })).rejects.toBeInstanceOf(
    ValidationError,
  );
  await expect(
    setup.execute({ ...base, accountId: 'acc-1', generateTransaction: true }),
  ).resolves.toBeDefined();
});

it('SHOULD answer 404 for a missing operation OR an asset the caller cannot reach', async () => {
  spies.findOperationById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 403 WHEN the linked account is one the caller cannot change', async () => {
  spies.findAccountForOperation.mockResolvedValueOnce({ ...mocks.account, ownerId: 'left-user' });

  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toThrow(
    new ForbiddenException("This operation uses an account you can't change"),
  );
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the edit would make the position negative', async () => {
  spies.writeOperation.mockRejectedValue(new NegativePositionError('2026-09-15', 'op-9'));

  await expect(setup.execute({ ...base, quantity: '1' })).rejects.toBeInstanceOf(
    UnprocessableEntityException,
  );
});

it('SHOULD reject an empty update', async () => {
  await expect(setup.execute(base)).rejects.toBeInstanceOf(ValidationError);
});
