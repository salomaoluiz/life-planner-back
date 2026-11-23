import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { market, shoppingList } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { base, day, mocks, setup } from './index.mocks';

it('SHOULD create the purchase with the client id AND the currency of the list', async () => {
  const result = await setup.execute(base);

  expect(result.created).toBe(true);
  expect(mocks.purchases.create).toHaveBeenCalledWith({
    currency: 'USD',
    id: base.id,
    listId: 'list-id',
    marketId: 'market-id',
    owner: 'USER',
    ownerId: 'user-id',
    purchaseDate: day('2026-11-18'),
    userId: 'user-id',
  });
});

it('SHOULD answer 404 for a list or market the caller cannot reach', async () => {
  mocks.lists.findById.mockResolvedValue(undefined);
  await expect(setup.execute(base)).rejects.toThrow(NotFoundException);

  mocks.lists.findById.mockResolvedValue(shoppingList('list-id'));
  mocks.markets.findById.mockResolvedValue(market('market-id', { ownerId: 'stranger' }));
  await expect(setup.execute(base)).rejects.toThrow(NotFoundException);
});

it('SHOULD refuse (422) an archived list, an archived market AND a market of another owner', async () => {
  mocks.lists.findById.mockResolvedValue(
    shoppingList('list-id', { status: StockCatalogStatus.ARCHIVED }),
  );
  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);

  mocks.lists.findById.mockResolvedValue(shoppingList('list-id'));
  mocks.markets.findById.mockResolvedValue(
    market('market-id', { status: StockCatalogStatus.ARCHIVED }),
  );
  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);

  mocks.markets.findById.mockResolvedValue(
    market('market-id', { owner: 'FAMILY' as never, ownerId: 'family-id' }),
  );
  await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.purchases.create).not.toHaveBeenCalled();
});
