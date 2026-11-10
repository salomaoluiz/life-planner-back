import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  fixedIncomeTermsFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { setup, spies } from './index.mocks';

const input = {
  accessibleOwners: [{ owner: OwnerType.USER, ownerId: 'user-1' }],
  assetId: 'asset-fi',
  date: '2026-11-04',
  kind: 'PARTIAL' as never,
  netAmount: 600_000,
};

beforeEach(() => {
  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([['asset-fi', fixedIncomeDataFixture()]]),
  );
});

it('SHOULD return the lots used, the taxes AND what stays applied without writing', async () => {
  const result = await setup.execute(input);

  expect(result.net).toBe(600_000);
  expect(result.gross).toBe(result.net + result.iof + result.ir);
  expect(result.lots.map((lot) => lot.operationId)).toEqual(['lot-1']);
  expect(result.remaining.principal).toBeGreaterThan(0);
  expect(result.remaining.principal).toBeLessThan(1_000_000);
  expect(result.liquidityWarning).toBeNull();
  expect(spies.writeOperation).not.toHaveBeenCalled();
});

it('SHOULD answer 422 with availableNet WHEN a partial is larger than the title', async () => {
  await expect(setup.execute({ ...input, netAmount: 90_000_000 })).rejects.toMatchObject({
    response: { details: { availableNet: expect.any(Number) } },
  });
});

it('SHOULD estimate a total with the estimated net', async () => {
  const result = await setup.execute({ ...input, kind: 'TOTAL' as never, netAmount: 1_050_000 });

  expect(result.remaining.principal).toBe(0);
  expect(result.lots[0].principalUsed).toBe(1_000_000);
});

it('SHOULD carry the liquidity warning', async () => {
  spies.findFixedIncomeByAssetIds.mockResolvedValue(
    new Map([
      [
        'asset-fi',
        fixedIncomeDataFixture({
          terms: fixedIncomeTermsFixture({ liquidity: 'AT_MATURITY' as never }),
        }),
      ],
    ]),
  );

  expect((await setup.execute(input)).liquidityWarning).toBe('AT_MATURITY');
});

it('SHOULD answer 404 for an unreachable asset AND 422 for a manual one', async () => {
  spies.findAssetById.mockResolvedValue({ ...fixedIncomeDetailFixture(), ownerId: 'other' });

  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);

  spies.findAssetById.mockResolvedValue(fixedIncomeDetailFixture());
  spies.findFixedIncomeByAssetIds.mockResolvedValue(new Map());

  await expect(setup.execute(input)).rejects.toThrow(UnprocessableEntityException);
});
