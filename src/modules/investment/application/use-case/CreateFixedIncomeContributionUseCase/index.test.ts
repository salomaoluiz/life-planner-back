import { UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  operationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  accountId: 'acc-1',
  amount: 500_000,
  assetId: 'asset-fi',
  date: '2026-10-20',
  generateTransaction: true,
};
const written = operationFixture({ assetId: 'asset-fi', id: 'lot-2' });

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T15:00:00Z'));
  const detail = fixedIncomeDetailFixture();

  spies.findAssetById
    .mockResolvedValueOnce(detail)
    .mockResolvedValue({ ...detail, operations: [written, ...detail.operations] });
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );
  spies.findAccountForOperation.mockResolvedValue({
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  });
  spies.writeOperation.mockResolvedValue('lot-2');
});

afterEach(() => jest.useRealTimers());

it('SHOULD store the amount as principal in reais at unit price 1, without fees', async () => {
  const result = await setup.execute(input);

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId: 'acc-1',
      assetLabel: 'Itausa PN',
      currency: 'BRL',
      fees: [],
      gross: 500_000,
      total: 500_000,
      type: 'BUY',
    }),
  );
  expect(spies.writeOperation.mock.calls[0][0].quantity.toString()).toBe('5000');
  expect(result.operation.operation.id).toBe('lot-2');
  expect(result.liquidityWarning).toBeNull();
});

it('SHOULD refuse a contribution after the maturity', async () => {
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([
      [
        'asset-fi',
        fixedIncomeDataFixture({
          terms: { ...fixedIncomeDataFixture().terms, maturityDate: '2026-10-01' },
        }),
      ],
    ]),
  );

  await expect(setup.execute(input)).rejects.toThrow(UnprocessableEntityException);
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD refuse a contribution dated before the first rate', async () => {
  await expect(setup.execute({ ...input, date: '2025-12-30' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD answer 422 with the redemption WHEN it no longer fits', async () => {
  spies.writeOperation.mockRejectedValue(
    new FixedIncomeRedemptionTooLargeError('2026-11-04', 'sell-1'),
  );

  await expect(setup.execute(input)).rejects.toMatchObject({
    response: { details: { date: '2026-11-04', operationId: 'sell-1' } },
  });
});

it('SHOULD refuse an asset that is not a calculated title', async () => {
  spies.findFixedIncomeByAssetIds.mockResolvedValue(new Map());

  await expect(setup.execute(input)).rejects.toThrow(UnprocessableEntityException);
});
