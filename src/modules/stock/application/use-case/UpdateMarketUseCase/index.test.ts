import { NotFoundException } from '@nestjs/common';

import { market } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

it('SHOULD rename, move the neighborhood AND archive', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: 'm',
    name: 'Novo',
    neighborhood: null,
    status: StockCatalogStatus.ARCHIVED,
  });

  expect(mocks.markets.update).toHaveBeenCalledWith({
    id: 'm',
    name: 'Novo',
    neighborhood: null,
    status: 'ARCHIVED',
  });
});

it('SHOULD answer 404 for a missing market or one of another owner', async () => {
  mocks.markets.findById.mockResolvedValue(undefined);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'm', name: 'x' }),
  ).rejects.toThrow(NotFoundException);

  mocks.markets.findById.mockResolvedValue(market('m', { ownerId: 'stranger' }));
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'm', name: 'x' }),
  ).rejects.toThrow(NotFoundException);
});
