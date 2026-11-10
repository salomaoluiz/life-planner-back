import { UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  fixedIncomeTermsFixture,
  operationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  accountId: 'acc-1',
  assetId: 'asset-fi',
  date: '2026-11-04',
  generateTransaction: true,
  kind: 'PARTIAL' as never,
  netAmount: 600_000,
};

function seed(terms = fixedIncomeTermsFixture()) {
  const detail = fixedIncomeDetailFixture();

  spies.findAssetById.mockResolvedValueOnce(detail).mockResolvedValue({
    ...detail,
    operations: [operationFixture({ assetId: 'asset-fi', id: 'sell-1' }), ...detail.operations],
  });
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture({ terms })]]),
  );
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T15:00:00Z'));
  spies.findAccountForOperation.mockResolvedValue({
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  });
  spies.writeOperation.mockResolvedValue('sell-1');
});

afterEach(() => jest.useRealTimers());

it('SHOULD write a SELL with the typed net AND placeholders for the derived columns', async () => {
  seed();

  const result = await setup.execute(input);

  expect(spies.writeOperation).toHaveBeenCalledWith(
    expect.objectContaining({
      netAmount: 600_000,
      redemptionKind: 'PARTIAL',
      total: 600_000,
      type: 'SELL',
    }),
  );
  expect(spies.writeOperation.mock.calls[0][0].quantity.toString()).toBe('0.01');
  expect(result.liquidityWarning).toBeNull();
});

it('SHOULD warn but still save WHEN redeeming before an at-maturity liquidity', async () => {
  seed(fixedIncomeTermsFixture({ liquidity: 'AT_MATURITY' as never }));

  const result = await setup.execute(input);

  expect(result.liquidityWarning).toBe('AT_MATURITY');
  expect(spies.writeOperation).toHaveBeenCalled();
});

it('SHOULD warn WHEN before the grace period date AND not after it', async () => {
  seed(
    fixedIncomeTermsFixture({ liquidity: 'GRACE_PERIOD' as never, liquidityDate: '2027-01-01' }),
  );

  expect((await setup.execute(input)).liquidityWarning).toBe('GRACE_PERIOD');

  jest.resetAllMocks();
  spies.findAccountForOperation.mockResolvedValue({
    archived: false,
    currency: 'BRL',
    id: 'acc-1',
    owner: OwnerType.USER,
    ownerId: 'user-1',
  });
  spies.writeOperation.mockResolvedValue('sell-1');
  seed(
    fixedIncomeTermsFixture({ liquidity: 'GRACE_PERIOD' as never, liquidityDate: '2026-06-01' }),
  );

  expect((await setup.execute(input)).liquidityWarning).toBeNull();
});

it('SHOULD refuse a redemption dated before the first contribution', async () => {
  seed();

  await expect(setup.execute({ ...input, date: '2025-12-01' })).rejects.toThrow(
    UnprocessableEntityException,
  );
  expect(spies.writeOperation).not.toHaveBeenCalled();
});
