import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { category, location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup, useCases } from './stock.service.mocks';

const { accessibleOwners, userId } = mocks;

describe('items', () => {
  it('SHOULD output the lean list item (no lots) with days as YYYY-MM-DD and nulls for absent values', async () => {
    useCases.getStockItems.execute.mockResolvedValue([mocks.view]);

    const [row] = await setup.findAll(userId, {
      categoryId: ['c'],
      ownerId: 'o',
      today: '2026-11-10',
    });

    expect(useCases.getStockItems.execute).toHaveBeenCalledWith({
      accessibleOwners,
      categoryIds: ['c'],
      locationIds: undefined,
      ownerId: 'o',
      today: '2026-11-10',
    });
    expect(row).not.toHaveProperty('lots');
    expect(row).toMatchObject({
      barcode: null,
      brand: 'Brand',
      category: {
        archived: false,
        name: 'Category cheese',
        path: 'Category dairy / Category cheese',
      },
      expirationStatus: 'EXPIRING',
      hasOpenLot: true,
      idealQuantity: 4,
      minQuantity: 1,
      nearestExpiration: '2026-11-10',
      needsRestock: false,
      quantity: 3,
      restockQuantity: 1,
    });
  });

  it('SHOULD output the detail with its lots (open first) AND their effective expiration and status', async () => {
    useCases.getStockItemById.execute.mockResolvedValue(mocks.view);

    const detail = await setup.findById(userId, 'item', '2026-11-10');

    expect(useCases.getStockItemById.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'item',
      today: '2026-11-10',
    });
    expect(detail.lots.map((entry) => entry.id)).toEqual(['open', 'closed']);
    expect(detail.lots[0]).toMatchObject({
      effectiveExpiration: '2026-11-10',
      expirationDate: '2026-12-01',
      expirationStatus: 'EXPIRING',
      openedAt: '2026-11-05',
      purchaseDate: '2026-11-01',
    });
    expect(detail.lots[1]).toMatchObject({ effectiveExpiration: null, openedAt: null });
  });

  it('SHOULD resolve the accessible owners (the caller plus its families) for every action', async () => {
    useCases.createStockItem.execute.mockResolvedValue(mocks.view);
    useCases.updateStockItem.execute.mockResolvedValue(mocks.view);

    await setup.create(userId, {
      description: 'x',
      owner: OwnerType.USER,
      ownerId: userId,
      unit: 'unit',
    } as never);
    await setup.update(userId, 'item', { notes: 'n' });
    await setup.delete(userId, 'item');

    expect(useCases.createStockItem.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners, userId }),
    );
    expect(useCases.updateStockItem.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'item',
      notes: 'n',
    });
    expect(useCases.deleteStockItem.execute).toHaveBeenCalledWith({ accessibleOwners, id: 'item' });
  });

  it('SHOULD pass the owner change preview and the suggestions through', async () => {
    useCases.getOwnerChangePreview.execute.mockResolvedValue({
      category: { from: null, to: null },
      location: { from: null, to: null },
    });
    useCases.suggestStockItems.execute.mockResolvedValue([
      { brand: undefined, description: 'Milk', id: 'a', quantity: 2, score: 0.9, unit: 'unit' },
    ]);

    await setup.ownerChangePreview(userId, 'item', OwnerType.FAMILY, 'family-id');
    const suggestions = await setup.suggest(userId, {
      owner: OwnerType.USER,
      ownerId: userId,
      q: 'milk',
    });

    expect(useCases.getOwnerChangePreview.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'item',
      owner: 'FAMILY',
      ownerId: 'family-id',
    });
    expect(suggestions).toEqual({
      items: [{ brand: null, description: 'Milk', id: 'a', quantity: 2, score: 0.9, unit: 'unit' }],
    });
  });
});

describe('movements', () => {
  it('SHOULD show the author WHEN still a member of the family, "null" (Ex-membro) otherwise', async () => {
    const family = {
      ...mocks.view,
      item: { ...mocks.view.item, owner: OwnerType.FAMILY, ownerId: mocks.familyId },
    };

    useCases.createStockMovement.execute.mockResolvedValue({
      item: family,
      movements: [mocks.movement('author'), mocks.movement('gone'), mocks.movement()],
    });

    const result = await setup.createMovement(userId, 'item', {
      quantity: 1,
      type: 'ENTRY',
    } as never);

    expect(result.movements.map((entry) => entry.user)).toEqual([
      { id: 'author', name: 'Ana' },
      null,
      null,
    ]);
    expect(useCases.getFamilyMembers.execute).toHaveBeenCalledWith({
      familyId: mocks.familyId,
      userId,
    });
    expect(result.item.id).toBe('item');
  });

  it('SHOULD treat only the owner as a member of a personal item AND tolerate an unreadable family', async () => {
    useCases.getStockMovements.execute.mockResolvedValue({
      items: [mocks.movement(userId)],
      nextCursor: 'next',
      owner: { owner: OwnerType.USER, ownerId: userId },
    });
    useCases.findUsersByIds.execute.mockResolvedValue([{ id: userId, name: 'Me' }]);

    const page = await setup.findMovements(userId, 'item', 'cursor');

    expect(page.nextCursor).toBe('next');
    expect(page.items[0]).toMatchObject({
      createdAt: '2026-11-10T12:00:00.000Z',
      note: null,
      reason: null,
      user: { id: userId, name: 'Me' },
    });
    expect(useCases.getFamilyMembers.execute).not.toHaveBeenCalled();
    expect(useCases.getStockItemById.execute).not.toHaveBeenCalled();

    useCases.getStockMovements.execute.mockResolvedValue({
      items: [mocks.movement(userId)],
      nextCursor: null,
      owner: { owner: OwnerType.FAMILY, ownerId: mocks.familyId },
    });
    useCases.getFamilyMembers.execute.mockRejectedValue(new Error('404'));
    expect((await setup.findMovements(userId, 'item')).items[0].user).toBeNull();
  });
});

describe('categories', () => {
  it('SHOULD nest the categories into a tree with counts and the inherited mapping', async () => {
    useCases.getStockCategories.execute.mockResolvedValue([
      {
        category: category('dairy', { financeCategoryId: 'fin' }),
        effectiveFinanceCategoryId: 'fin',
        itemCount: 1,
      },
      {
        category: category('cheese', { parentId: 'dairy' }),
        effectiveFinanceCategoryId: 'fin',
        itemCount: 4,
      },
      { category: category('meat'), itemCount: 0 },
    ]);

    const { items } = await setup.findCategories(userId, {
      includeArchived: false,
      owner: OwnerType.USER,
      ownerId: userId,
    });

    expect(items.map((node) => node.id)).toEqual(['dairy', 'meat']);
    expect(items[0].children[0]).toMatchObject({
      effectiveFinanceCategoryId: 'fin',
      financeCategoryId: null,
      id: 'cheese',
      itemCount: 4,
      parentId: 'dairy',
    });
    expect(items[1].effectiveFinanceCategoryId).toBeNull();
  });

  it('SHOULD read the usable finance categories only WHEN a mapping is sent, with type and archived flag', async () => {
    useCases.createStockCategory.execute.mockResolvedValue(category('new'));
    useCases.getCategories.execute.mockResolvedValue([
      { id: 'fin', status: 'ACTIVE', type: 'EXPENSE' },
      { id: 'inc', status: 'ARCHIVED', type: 'INCOME' },
    ]);

    await setup.createCategory(userId, { name: 'A', owner: OwnerType.USER, ownerId: userId });
    expect(useCases.getCategories.execute).not.toHaveBeenCalled();

    await setup.createCategory(userId, {
      financeCategoryId: 'fin',
      name: 'A',
      owner: OwnerType.USER,
      ownerId: userId,
    });
    expect(useCases.getCategories.execute).toHaveBeenCalledWith({
      accessibleOwners,
      ownerIds: [userId],
    });
    expect(useCases.createStockCategory.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        financeCategories: [
          { archived: false, id: 'fin', isExpense: true },
          { archived: true, id: 'inc', isExpense: false },
        ],
      }),
    );
  });

  it('SHOULD scope the finance categories of an update to the owner of the stock category', async () => {
    useCases.getStockCategories.execute.mockImplementation(async ({ ownerId }) =>
      ownerId === mocks.familyId ? [{ category: category('target'), itemCount: 0 }] : [],
    );
    useCases.updateStockCategory.execute.mockResolvedValue(category('target'));
    useCases.getCategories.execute.mockResolvedValue([]);

    await setup.updateCategory(userId, 'target', { financeCategoryId: 'fin' });
    expect(useCases.getCategories.execute).toHaveBeenCalledWith({
      accessibleOwners,
      ownerIds: [mocks.familyId],
    });

    useCases.getStockCategories.execute.mockResolvedValue([]);
    await setup.updateCategory(userId, 'ghost', { financeCategoryId: 'fin' });
    expect(useCases.getCategories.execute).toHaveBeenLastCalledWith({
      accessibleOwners,
      ownerIds: [userId],
    });

    await setup.updateCategory(userId, 'target', { name: 'x' });
    expect(useCases.updateStockCategory.execute).toHaveBeenLastCalledWith({
      accessibleOwners,
      financeCategories: undefined,
      id: 'target',
      name: 'x',
    });
  });

  it('SHOULD create suggestions and delete', async () => {
    useCases.createStockCategorySuggestions.execute.mockResolvedValue([category('a')]);

    const result = await setup.createCategorySuggestions(
      userId,
      { owner: OwnerType.USER, ownerId: userId },
      'pt-BR',
    );
    await setup.deleteCategory(userId, 'a');

    expect(result.items[0]).toMatchObject({ financeCategoryId: null, id: 'a', parentId: null });
    expect(useCases.createStockCategorySuggestions.execute).toHaveBeenCalledWith({
      accessibleOwners,
      language: 'pt-BR',
      owner: 'USER',
      ownerId: userId,
    });
    expect(useCases.deleteStockCategory.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'a',
    });
  });
});

describe('locations', () => {
  it('SHOULD list with item counts, create, update, delete and create suggestions', async () => {
    useCases.getStockLocations.execute.mockResolvedValue([
      { itemCount: 2, location: location('a') },
    ]);
    useCases.createStockLocation.execute.mockResolvedValue(location('b'));
    useCases.updateStockLocation.execute.mockResolvedValue(location('b'));
    useCases.createStockLocationSuggestions.execute.mockResolvedValue([location('c')]);

    expect(
      await setup.findLocations(userId, {
        includeArchived: true,
        owner: OwnerType.USER,
        ownerId: userId,
      }),
    ).toEqual({
      items: [expect.objectContaining({ id: 'a', itemCount: 2 })],
    });
    expect(
      await setup.createLocation(userId, { name: 'x', owner: OwnerType.USER, ownerId: userId }),
    ).not.toHaveProperty('itemCount');
    await setup.updateLocation(userId, 'b', { name: 'y' });
    await setup.deleteLocation(userId, 'b');
    expect(
      (
        await setup.createLocationSuggestions(
          userId,
          { owner: OwnerType.USER, ownerId: userId },
          'en-US',
        )
      ).items,
    ).toHaveLength(1);

    expect(useCases.updateStockLocation.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'b',
      name: 'y',
    });
    expect(useCases.deleteStockLocation.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'b',
    });
  });
});

describe('spec 117', () => {
  it('SHOULD read frequent items for the requester owners and return list items', async () => {
    useCases.getFrequentStockItems.execute.mockResolvedValue([mocks.view]);

    const result = await setup.findFrequent(userId, { limit: 3 });

    expect(useCases.getFrequentStockItems.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: mocks.accessibleOwners, limit: 3 }),
    );
    expect(result.items[0]).toMatchObject({ hasExpiredLot: false, id: 'item', quickStep: null });
    expect(result.items[0]).not.toHaveProperty('lots');
  });

  it('SHOULD undo a gesture and change its expiration returning the item', async () => {
    useCases.undoStockGesture.execute.mockResolvedValue(mocks.view);
    useCases.setGestureExpiration.execute.mockResolvedValue(mocks.view);

    expect((await setup.undoGesture(userId, 'g')).item.id).toBe('item');
    expect(
      (await setup.setGestureExpiration(userId, 'g', { expirationDate: '2026-12-05' })).item.lots,
    ).toHaveLength(2);
    expect(useCases.setGestureExpiration.execute).toHaveBeenCalledWith(
      expect.objectContaining({ gestureId: 'g', userId }),
    );
  });

  it('SHOULD return the location with its item count', async () => {
    useCases.getStockLocationById.execute.mockResolvedValue({
      itemCount: 4,
      location: mocks.catalog.locations[0],
    });

    expect(await setup.findLocationById(userId, 'fridge')).toMatchObject({
      id: 'fridge',
      itemCount: 4,
    });
  });
});

describe('spec 123', () => {
  it('SHOULD output the consumption weeks with days as YYYY-MM-DD', async () => {
    useCases.getConsumptionWeeks.execute.mockResolvedValue([
      { excluded: true, quantity: 0, start: new Date('2026-09-07T00:00:00.000Z') },
      { excluded: false, quantity: 2.5, start: new Date('2026-09-14T00:00:00.000Z') },
    ]);

    expect(await setup.findConsumptionWeeks(userId, 'i', '2026-11-25')).toEqual({
      weeks: [
        { excluded: true, quantity: 0, start: '2026-09-07' },
        { excluded: false, quantity: 2.5, start: '2026-09-14' },
      ],
    });
    expect(useCases.getConsumptionWeeks.execute).toHaveBeenCalledWith({
      accessibleOwners,
      id: 'i',
      today: '2026-11-25',
    });
  });

  it('SHOULD dismiss and undo the dismissal of a lot warning', async () => {
    await setup.dismissLeftover(userId, 'lot', true);
    await setup.dismissLeftover(userId, 'lot', false);

    expect(useCases.dismissLeftover.execute).toHaveBeenNthCalledWith(1, {
      accessibleOwners,
      dismissed: true,
      lotId: 'lot',
    });
    expect(useCases.dismissLeftover.execute).toHaveBeenNthCalledWith(2, {
      accessibleOwners,
      dismissed: false,
      lotId: 'lot',
    });
  });
});
