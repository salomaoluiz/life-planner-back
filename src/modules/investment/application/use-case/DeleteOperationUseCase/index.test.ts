import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetStatus } from '@investment/domain/enum';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { NegativePositionError } from '@investment/domain/error/NegativePositionError';

import { mocks, setup, spies } from './index.mocks';

const base = { accessibleOwners: mocks.owners, id: mocks.operation.id };

beforeEach(() => {
  spies.findOperationById.mockResolvedValue(mocks.operation);
  spies.findAssetById.mockResolvedValue(mocks.detail);
});

it('SHOULD delete the operation', async () => {
  await setup.execute(base);

  expect(spies.deleteOperation).toHaveBeenCalledWith(mocks.operation.id);
});

it('SHOULD answer 404 for a missing operation or an unreachable asset', async () => {
  spies.findOperationById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);

  spies.findAssetById.mockResolvedValueOnce({ ...mocks.detail, ownerId: 'other' });
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived asset', async () => {
  spies.findAssetById.mockResolvedValue({
    ...mocks.detail,
    status: InvestmentAssetStatus.ARCHIVED,
  });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);
  expect(spies.deleteOperation).not.toHaveBeenCalled();
});

it('SHOULD answer 403 WHEN the linked account cannot be changed by the caller', async () => {
  spies.findOperationById.mockResolvedValue(
    operationFixture({ accountId: 'acc-1', assetId: mocks.asset.id, generateTransaction: true }),
  );
  spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, ownerId: 'left-user' });

  await expect(setup.execute(base)).rejects.toBeInstanceOf(ForbiddenException);
});

it('SHOULD answer 422 WHEN a later sell depended on the operation, and pass other errors on', async () => {
  spies.deleteOperation.mockRejectedValueOnce(new NegativePositionError('2026-09-15', 'op-9'));
  await expect(setup.execute(base)).rejects.toBeInstanceOf(UnprocessableEntityException);

  spies.deleteOperation.mockRejectedValueOnce(new Error('db down'));
  await expect(setup.execute(base)).rejects.toThrow('db down');
});

it('SHOULD answer 422 with the redemption WHEN deleting a lot makes it larger than the title (spec 105)', async () => {
  spies.deleteOperation.mockRejectedValue(
    new FixedIncomeRedemptionTooLargeError('2026-11-04', 'sell-1'),
  );

  await expect(setup.execute(base)).rejects.toMatchObject({
    response: { details: { date: '2026-11-04', operationId: 'sell-1' } },
  });
});

describe('deleting an event (spec 108 FR 21)', () => {
  const event = operationFixture({
    assetId: mocks.asset.id,
    id: 'event-1',
    type: 'REVERSE_SPLIT' as never,
  });
  const sale = operationFixture({
    accountId: 'acc-1',
    assetId: mocks.asset.id,
    fractionOfOperationId: 'event-1',
    generateTransaction: true,
    id: 'sale-1',
  });

  beforeEach(() => {
    spies.findOperationById.mockResolvedValue(event);
    spies.findAssetById.mockResolvedValue({ ...mocks.detail, operations: [event, sale] });
  });

  it('SHOULD delete the event WHEN the account of its fraction sale is writable', async () => {
    spies.findAccountForOperation.mockResolvedValue(mocks.account);

    await setup.execute({ ...base, id: 'event-1' });

    expect(spies.findAccountForOperation).toHaveBeenCalledWith('acc-1');
    expect(spies.deleteOperation).toHaveBeenCalledWith('event-1');
  });

  it('SHOULD answer 403 WHEN the fraction sale uses an account the caller cannot change', async () => {
    spies.findAccountForOperation.mockResolvedValue({ ...mocks.account, ownerId: 'left-user' });

    await expect(setup.execute({ ...base, id: 'event-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(spies.deleteOperation).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 WHEN removing the event would break the position', async () => {
    spies.findAccountForOperation.mockResolvedValue(mocks.account);
    spies.deleteOperation.mockRejectedValue(new NegativePositionError('2026-04-01', 'sell-1'));

    await expect(setup.execute({ ...base, id: 'event-1' })).rejects.toMatchObject({ status: 422 });
  });
});
