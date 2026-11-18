import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { shoppingList } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const ids = { accessibleOwners: mocks.accessibleOwners };

it('SHOULD make another list the default (the datasource clears the previous one)', async () => {
  await setup.execute({ ...ids, id: 'o', isDefault: true });

  expect(mocks.lists.update).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'o', isDefault: true }),
  );
});

it('SHOULD refuse un-defaulting or archiving the default AND an archived list as default (422)', async () => {
  await expect(setup.execute({ ...ids, id: 'd', isDefault: false })).rejects.toThrow(
    UnprocessableEntityException,
  );
  await expect(
    setup.execute({ ...ids, id: 'd', status: StockCatalogStatus.ARCHIVED }),
  ).rejects.toThrow(UnprocessableEntityException);
  await expect(
    setup.execute({ ...ids, id: 'o', isDefault: true, status: StockCatalogStatus.ARCHIVED }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD answer 409 on a duplicate name WHEN renaming or reactivating, and allow the same name for itself', async () => {
  await expect(setup.execute({ ...ids, id: 'o', name: 'MERCADO' })).rejects.toThrow(
    ConflictException,
  );
  await expect(setup.execute({ ...ids, id: 'o', name: 'pharmacy' })).resolves.toBeDefined();
});

it('SHOULD archive without a name check AND reactivate checking the active names', async () => {
  await setup.execute({ ...ids, id: 'o', status: StockCatalogStatus.ARCHIVED });
  expect(mocks.lists.findByOwners).not.toHaveBeenCalled();

  await setup.execute({ ...ids, id: 'o', status: StockCatalogStatus.ACTIVE });
  expect(mocks.lists.findByOwners).toHaveBeenCalledTimes(1);
});

it('SHOULD answer 404 for a missing or unreachable list AND 422 for an archived family', async () => {
  await expect(setup.execute({ ...ids, id: 'gone', name: 'x' })).rejects.toThrow(NotFoundException);
  await expect(setup.execute({ accessibleOwners: [], id: 'o', name: 'x' })).rejects.toThrow(
    NotFoundException,
  );
  mocks.lists.findById.mockResolvedValue(
    shoppingList('f', { owner: OwnerType.FAMILY, ownerId: 'family-id' }),
  );
  await expect(
    setup.execute({ accessibleOwners: mocks.archivedOwners, id: 'o', name: 'x' }),
  ).rejects.toThrow(UnprocessableEntityException);
});
