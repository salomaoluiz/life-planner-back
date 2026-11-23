import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import {
  archivedOwners,
  category,
  item,
  location,
  lot,
  shoppingList,
} from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, OwnerType, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, id: 'item' };

it('SHOULD update the fields AND refresh the embedding WHEN the description changes', async () => {
  const view = await setup.execute({ ...input, description: 'Oat milk', notes: '' });

  expect(mocks.stock.update).toHaveBeenCalledWith(
    expect.objectContaining({ description: 'Oat milk', id: 'item', notes: null }),
  );
  expect(mocks.refresh.execute).toHaveBeenCalledWith({ id: 'item' });
  expect(view.quantity).toBe(1);
});

it('SHOULD not refresh the embedding WHEN neither the description nor the brand changed', async () => {
  await setup.execute({ ...input, notes: 'x' });

  expect(mocks.refresh.execute).not.toHaveBeenCalled();
});

it('SHOULD answer 404 for an item the caller cannot see', async () => {
  mocks.stock.findById.mockResolvedValue(undefined);
  await expect(setup.execute({ ...input, notes: 'x' })).rejects.toThrow(NotFoundException);

  mocks.stock.findById.mockResolvedValue(item([], (f) => f.withOwnerId('other')));
  await expect(setup.execute({ ...input, notes: 'x' })).rejects.toThrow(NotFoundException);
});

it('SHOULD refuse changing the unit WHEN any lot has quantity', async () => {
  mocks.stock.findById.mockResolvedValue(item([lot('a', 1)]));

  await expect(setup.execute({ ...input, unit: StockUnits.LITER })).rejects.toThrow(
    'Change the unit only when the item is empty',
  );
});

it('SHOULD allow changing the unit WHEN the item is empty', async () => {
  await setup.execute({ ...input, unit: StockUnits.LITER });

  expect(mocks.stock.update).toHaveBeenCalledWith(expect.objectContaining({ unit: 'liter' }));
});

it('SHOULD clear the minimum and ideal WHEN the item becomes stock-only', async () => {
  mocks.stock.findById.mockResolvedValue(item([], (f) => f.withMinQuantity(1, 3)));

  await setup.execute({ ...input, stockOnly: true });

  expect(mocks.stock.update).toHaveBeenCalledWith(
    expect.objectContaining({ idealQuantity: null, minQuantity: null, stockOnly: true }),
  );
});

it('SHOULD keep the stored minimum WHEN only the ideal changes AND validate against it', async () => {
  mocks.stock.findById.mockResolvedValue(item([], (f) => f.withMinQuantity(2)));

  await expect(setup.execute({ ...input, idealQuantity: 2 })).rejects.toThrow(
    UnprocessableEntityException,
  );
  await setup.execute({ ...input, idealQuantity: 5 });
  expect(mocks.stock.update).toHaveBeenCalledWith(
    expect.objectContaining({ idealQuantity: 5, minQuantity: undefined }),
  );
});

it('SHOULD allow clearing the minimum with null', async () => {
  mocks.stock.findById.mockResolvedValue(item([], (f) => f.withMinQuantity(2, 5)));

  await setup.execute({ ...input, idealQuantity: null, minQuantity: null });

  expect(mocks.stock.update).toHaveBeenCalledWith(
    expect.objectContaining({ idealQuantity: null, minQuantity: null }),
  );
});

describe('owner change', () => {
  const move = { ...input, owner: OwnerType.FAMILY, ownerId: mocks.familyId };

  it('SHOULD replace the category and location by the same-name ones of the new owner', async () => {
    mocks.stock.findById.mockResolvedValue(
      item([], (f) => f.withCategoryId('src-cat').withLocationId('src-loc')),
    );
    mocks.catalog.findCatalogByOwners.mockImplementation(async (owners) =>
      owners[0].owner === 'USER'
        ? {
            categories: [category('src-cat', { name: 'Dairy' })],
            locations: [location('src-loc', { name: 'Fridge' })],
            shoppingLists: [],
          }
        : {
            categories: [
              category('dst-cat', {
                name: 'dairy',
                owner: OwnerType.FAMILY,
                ownerId: mocks.familyId,
              }),
            ],
            locations: [
              location('dst-loc', {
                name: 'Fridge',
                owner: OwnerType.FAMILY,
                ownerId: mocks.familyId,
              }),
            ],
            shoppingLists: [],
          },
    );
    mocks.catalog.findCategoryById.mockResolvedValue(
      category('dst-cat', { owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    );
    mocks.catalog.findLocationById.mockResolvedValue(
      location('dst-loc', { owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    );

    await setup.execute(move);

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'dst-cat',
        locationId: 'dst-loc',
        owner: 'FAMILY',
        ownerId: mocks.familyId,
      }),
    );
  });

  it('SHOULD clear them WHEN the new owner has no match, and respect an explicit choice', async () => {
    mocks.stock.findById.mockResolvedValue(item([], (f) => f.withCategoryId('src-cat')));
    mocks.catalog.findCatalogByOwners.mockImplementation(async (owners) => ({
      categories: owners[0].owner === 'USER' ? [category('src-cat')] : [],
      locations: [],
      shoppingLists: [],
    }));

    await setup.execute(move);
    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: null, locationId: null }),
    );

    mocks.catalog.findCategoryById.mockResolvedValue(
      category('mine', { owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    );
    await setup.execute({ ...move, categoryId: 'mine' });
    expect(mocks.stock.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: 'mine' }),
    );
  });

  it('SHOULD refuse an owner the caller cannot access (403) and an archived destination (422)', async () => {
    await expect(setup.execute({ ...move, ownerId: 'other' })).rejects.toThrow(ForbiddenException);
    await expect(setup.execute({ ...move, accessibleOwners: archivedOwners })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

it('SHOULD throw ValidationError WHEN nothing is sent or only half of the owner', async () => {
  await expect(setup.execute(input)).rejects.toThrow(ValidationError);
  await expect(setup.execute({ ...input, owner: OwnerType.FAMILY })).rejects.toThrow(
    ValidationError,
  );
});

describe('shopping list (spec 118)', () => {
  it('SHOULD point the item to an active list of its owner AND store the typed price', async () => {
    mocks.lists.findById.mockResolvedValue(shoppingList('l'));

    await setup.execute({ ...input, estimatedUnitPriceCents: 489, shoppingListId: 'l' });

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedUnitPriceCents: 489, shoppingListId: 'l' }),
    );
  });

  it('SHOULD clear the pointer with null', async () => {
    await setup.execute({ ...input, shoppingListId: null });

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ shoppingListId: null }),
    );
  });

  it('SHOULD refuse a list of another owner (422) AND a list on a stock-only item (422)', async () => {
    mocks.lists.findById.mockResolvedValueOnce(shoppingList('l', { ownerId: 'someone-else' }));
    await expect(setup.execute({ ...input, shoppingListId: 'l' })).rejects.toThrow(
      UnprocessableEntityException,
    );

    await expect(setup.execute({ ...input, shoppingListId: 'l', stockOnly: true })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('SHOULD drop the pointer WHEN the item becomes stock-only', async () => {
    mocks.stock.findById.mockResolvedValue(item([], (f) => f.withShoppingListId('l')));

    await setup.execute({ ...input, stockOnly: true });

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ shoppingListId: null, stockOnly: true }),
    );
  });

  it('SHOULD replace the list by the same-name one of the new owner on an owner change', async () => {
    mocks.stock.findById.mockResolvedValue(item([], (f) => f.withShoppingListId('src-list')));
    mocks.catalog.findCatalogByOwners.mockImplementation(async (owners) => ({
      categories: [],
      locations: [],
      shoppingLists:
        owners[0].owner === 'USER'
          ? [shoppingList('src-list', { name: 'Pharmacy' })]
          : [
              shoppingList('dst-list', {
                name: 'pharmacy',
                owner: OwnerType.FAMILY,
                ownerId: mocks.familyId,
              }),
            ],
    }));
    mocks.lists.findById.mockResolvedValue(
      shoppingList('dst-list', { owner: OwnerType.FAMILY, ownerId: mocks.familyId }),
    );

    await setup.execute({ ...input, owner: OwnerType.FAMILY, ownerId: mocks.familyId });

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'FAMILY', shoppingListId: 'dst-list' }),
    );
  });
});

describe('barcode (spec 121)', () => {
  it('SHOULD normalize the new code', async () => {
    mocks.stock.findByOwners.mockResolvedValue([]);

    await setup.execute({ ...input, barcode: '036000291452' });

    expect(mocks.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: '0036000291452' }),
    );
  });

  it('SHOULD clear the code WITHOUT checking conflicts WHEN it is null', async () => {
    await setup.execute({ ...input, barcode: null });

    expect(mocks.stock.update).toHaveBeenCalledWith(expect.objectContaining({ barcode: null }));
    expect(mocks.stock.findByOwners).not.toHaveBeenCalled();
  });

  it('SHOULD answer 409 BARCODE_IN_USE WHEN another item of the owner has the code', async () => {
    mocks.stock.findByOwners.mockResolvedValue([item([], (f) => f.withId('other'))]);

    await expect(setup.execute({ ...input, barcode: '7891000100103' })).rejects.toMatchObject({
      response: { code: 'BARCODE_IN_USE', itemId: 'other' },
    });
  });

  it('SHOULD refuse an invalid code with 422', async () => {
    await expect(setup.execute({ ...input, barcode: '7891000100104' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
