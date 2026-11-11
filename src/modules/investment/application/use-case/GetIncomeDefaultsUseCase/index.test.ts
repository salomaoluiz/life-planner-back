import { NotFoundException } from '@nestjs/common';

import { incomeCategoryFixture } from '@investment/domain/entity/mocks/income.fixture';
import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, assetId: scenario.asset.id };

it('SHOULD answer the account of the first buy, the last category of the type, the position AND the rate', async () => {
  spies.investment.findAssetById.mockResolvedValue({
    ...scenario.detail,
    operations: [
      operationFixture({
        date: '2026-01-10',
        id: 'b1',
        quantity: Decimal8.parse('300'),
        total: 1000,
      }),
      operationFixture({
        date: '2026-12-10',
        id: 'b2',
        quantity: Decimal8.parse('100'),
        total: 1000,
      }),
    ],
  });

  expect(
    await setup.execute({ ...base, exDate: '2026-11-21', type: InvestmentIncomeType.JCP }),
  ).toEqual({
    accountId: 'acc-1',
    categoryId: 'cat-1',
    currency: 'BRL',
    quantity: '300',
    type: InvestmentIncomeType.JCP,
    withholdingRate: '0.15',
  });
  expect(spies.incomes.findLastIncomeCategoryId).toHaveBeenCalledWith(
    scenario.asset.owner,
    scenario.asset.ownerId,
    InvestmentIncomeType.JCP,
  );
});

it('SHOULD use the position today WHEN there is no ex-date AND the class default type', async () => {
  spies.investment.findAssetById.mockResolvedValue({
    ...scenario.detail,
    assetClass: InvestmentAssetClass.BR_REIT,
    operations: [operationFixture({ date: '2026-01-10', quantity: Decimal8.parse('50') })],
  });

  expect(await setup.execute(base)).toMatchObject({
    quantity: '50',
    type: InvestmentIncomeType.YIELD,
    withholdingRate: '0',
  });
});

it('SHOULD start without account WHEN the default account is archived, in another currency OR out of reach', async () => {
  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    archived: true,
  });
  expect((await setup.execute(base)).accountId).toBeNull();

  spies.investment.findAccountForOperation.mockResolvedValueOnce({
    ...scenario.account,
    currency: 'USD',
  });
  expect((await setup.execute(base)).accountId).toBeNull();

  spies.investment.findAccountForOperation.mockResolvedValueOnce(undefined);
  expect((await setup.execute(base)).accountId).toBeNull();
});

it('SHOULD start without account WHEN no buy has a finance row', async () => {
  spies.incomes.findDefaultAccountId.mockResolvedValue(undefined);

  expect((await setup.execute(base)).accountId).toBeNull();
});

it('SHOULD start without category WHEN the last one is archived OR none was used yet', async () => {
  spies.incomes.findCategoryById.mockResolvedValueOnce(incomeCategoryFixture({ archived: true }));
  expect((await setup.execute(base)).categoryId).toBeNull();

  spies.incomes.findLastIncomeCategoryId.mockResolvedValue(undefined);
  expect((await setup.execute(base)).categoryId).toBeNull();
});

it('SHOULD check the category against the asset owner WHEN there is no default account', async () => {
  spies.incomes.findDefaultAccountId.mockResolvedValue(undefined);

  expect((await setup.execute(base)).categoryId).toBe('cat-1');
});

it('SHOULD answer 404 WHEN the asset is out of reach', async () => {
  spies.investment.findAssetById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});
