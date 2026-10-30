import { faker } from '@faker-js/faker';

import { TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './category.service.mocks';

describe('create', () => {
  it('SHOULD add the accessible owners AND map root parentId undefined to null', async () => {
    const body = {
      icon: 'cart',
      iconColor: '#2E7D32',
      name: 'Groceries',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      type: TransactionType.EXPENSE,
    };

    const result = await setup.create(mocks.userId, body);

    expect(mocks.createCategoryUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
      callerId: mocks.userId,
    });
    expect(result).toEqual(mocks.rootApi);
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds and type AND map a child parentId', async () => {
    mocks.getCategoriesUseCase.execute.mockResolvedValueOnce([mocks.childResult]);

    const result = await setup.findAll(mocks.userId, ['o1'], TransactionType.EXPENSE);

    expect(mocks.getCategoriesUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['o1'],
      type: TransactionType.EXPENSE,
    });
    expect(result[0].parentId).toBe(mocks.childResult.parentId);
    expect(result[0].depthLevel).toBe(1);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch (parentId null = make root)', async () => {
    await setup.update(mocks.userId, 'cat-1', { parentId: null });

    expect(mocks.updateCategoryUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      callerId: mocks.userId,
      id: 'cat-1',
      parentId: null,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, 'cat-1');

    expect(mocks.deleteCategoryUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'cat-1',
    });
  });
});

describe('ALL category output', () => {
  const familyA = faker.string.uuid();
  const familyB = faker.string.uuid();
  const creatorId = faker.string.uuid();
  const allResult = {
    ...mocks.childResult,
    allScopes: true,
    creatorId,
    owner: OwnerType.USER,
    ownerId: creatorId,
    parentId: undefined,
    scopes: [
      { owner: OwnerType.FAMILY, ownerId: familyA },
      { owner: OwnerType.USER, ownerId: creatorId },
      { owner: OwnerType.FAMILY, ownerId: familyB },
    ],
  };

  it('SHOULD show the creator every scope, Personal first, as scope ALL', async () => {
    mocks.financeAccessService.resolve.mockResolvedValueOnce([
      { owner: OwnerType.USER, ownerId: creatorId },
      { owner: OwnerType.FAMILY, ownerId: familyA },
      { owner: OwnerType.FAMILY, ownerId: familyB },
    ]);
    mocks.getCategoriesUseCase.execute.mockResolvedValueOnce([allResult]);

    const [result] = await setup.findAll(creatorId);

    expect(result.scope).toBe('ALL');
    expect(result.owner).toBe(OwnerType.USER);
    expect(result.ownerId).toBe(creatorId);
    expect(result.scopes.map((scope) => scope.ownerId)).toEqual([creatorId, familyA, familyB]);
  });

  it('SHOULD show another member only the scopes they reach AND never the creator Personal scope', async () => {
    mocks.financeAccessService.resolve.mockResolvedValueOnce([
      { owner: OwnerType.USER, ownerId: faker.string.uuid() },
      { owner: OwnerType.FAMILY, ownerId: familyB },
    ]);
    mocks.getCategoriesUseCase.execute.mockResolvedValueOnce([allResult]);

    const [result] = await setup.findAll(faker.string.uuid());

    expect(result.scope).toBe('ALL');
    expect(result.scopes).toEqual([{ owner: OwnerType.FAMILY, ownerId: familyB }]);
    expect(result.owner).toBe(OwnerType.FAMILY);
    expect(result.ownerId).toBe(familyB);
  });
});

describe('updateAppearance (spec 058)', () => {
  it('SHOULD run the subtree use case with the caller scope and map every category', async () => {
    const result = await setup.updateAppearance(mocks.userId, mocks.rootApi.id, {
      descendants: [{ icon: 'folder', id: mocks.childResult.id }],
      iconColor: '#112233',
    });

    expect(mocks.updateCategorySubtreeAppearanceUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleOwners: mocks.accessibleOwners,
        callerId: mocks.userId,
        descendants: [{ icon: 'folder', id: mocks.childResult.id }],
        iconColor: '#112233',
        id: mocks.rootApi.id,
      }),
    );
    expect(result.map((category) => category.id)).toEqual([mocks.rootApi.id, mocks.childResult.id]);
    expect(result[0]).toEqual(mocks.rootApi);
  });
});
