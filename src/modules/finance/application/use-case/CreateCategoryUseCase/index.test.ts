import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD create a root category (depthLevel 0, default color) AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.categoryRepository.findCategoryById).not.toHaveBeenCalled();
  expect(mocks.categoryRepository.createCategory).toHaveBeenCalledWith({
    depthLevel: 0,
    icon: 'store',
    iconColor: '#000000',
    name: 'Supermarket',
    owner: OwnerType.USER,
    ownerId: mocks.userId,
    parentId: undefined,
    type: TransactionType.EXPENSE,
  });
  expect(result).toBe(mocks.created);
});

it('SHOULD give a child depthLevel = parent.depthLevel + 1', async () => {
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce({
    ...mocks.parent,
    depthLevel: 2,
  });

  await setup.execute({ ...mocks.input, parentId: mocks.parent.id });

  expect(mocks.categoryRepository.createCategory).toHaveBeenCalledWith(
    expect.objectContaining({ depthLevel: 3, parentId: mocks.parent.id }),
  );
});

it('SHOULD keep a valid #RRGGBB color (any case) AND trim name / icon', async () => {
  await setup.execute({
    ...mocks.input,
    icon: ' store ',
    iconColor: '#2e7D32',
    name: ' Supermarket ',
  });

  expect(mocks.categoryRepository.createCategory).toHaveBeenCalledWith(
    expect.objectContaining({ icon: 'store', iconColor: '#2e7D32', name: 'Supermarket' }),
  );
});

it('SHOULD throw Forbidden (403) WHEN the owner is not accessible, BEFORE touching the parent', async () => {
  await expect(
    setup.execute({
      ...mocks.input,
      owner: OwnerType.FAMILY,
      ownerId: 'other-family',
      parentId: 'p',
    }),
  ).rejects.toThrow(ForbiddenException);
  expect(mocks.categoryRepository.findCategoryById).not.toHaveBeenCalled();
  expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
});

it.each([
  ['does not exist', undefined],
  [
    'belongs to someone the caller cannot access',
    {
      ...mocks.parent,
      ownerId: 'stranger',
      scopes: [{ owner: OwnerType.USER, ownerId: 'stranger' }],
    },
  ],
])('SHOULD throw NotFound (404) WHEN the parent %s', async (_label, found) => {
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(found);

  await expect(setup.execute({ ...mocks.input, parentId: 'p' })).rejects.toThrow(NotFoundException);
  expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
});

it.each([
  [
    'another owner type (accessible FAMILY parent for a USER category)',
    {
      ...mocks.parent,
      owner: OwnerType.FAMILY,
      ownerId: 'family-id',
      scopes: [{ owner: OwnerType.FAMILY, ownerId: 'family-id' }],
    },
  ],
  [
    'another type (INCOME parent, EXPENSE child)',
    { ...mocks.parent, type: TransactionType.INCOME },
  ],
])('SHOULD throw BadRequest (400) WHEN the parent has %s', async (_label, found) => {
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(found);

  await expect(setup.execute({ ...mocks.input, parentId: 'p' })).rejects.toThrow(
    BadRequestException,
  );
  expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
});

it.each([
  ['invalid color (name)', { iconColor: 'red' }],
  ['short hex', { iconColor: '#FFF' }],
  ['hex without #', { iconColor: '2E7D32' }],
  ['empty name', { name: ' ' }],
  ['61-character name', { name: 'a'.repeat(61) }],
  ['51-character icon', { icon: 'a'.repeat(51) }],
  ['unknown type', { type: 'TRANSFER' }],
])('SHOULD throw ValidationError WHEN %s', async (_label, patch) => {
  await expect(setup.execute({ ...mocks.input, ...patch } as never)).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
});

it('SHOULD throw Unprocessable (422) WHEN the parent is a system category (nothing can hang under it)', async () => {
  await expect(
    setup.execute({
      ...mocks.input,
      parentId: SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT],
    }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.categoryRepository.findCategoryById).not.toHaveBeenCalled();
  expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
});

describe('ALL scope', () => {
  const allScopes = [
    { owner: OwnerType.USER, ownerId: mocks.userId },
    { owner: OwnerType.FAMILY, ownerId: mocks.familyId },
  ];
  const allInput = {
    accessibleOwners: allScopes,
    callerId: mocks.userId,
    icon: 'store',
    name: 'Supermarket',
    owner: 'ALL' as const,
    type: TransactionType.EXPENSE,
  };
  const allParent = new CategoryEntityFixture()
    .withId('all-parent')
    .withAllScopes(allScopes, mocks.userId)
    .build();

  it('SHOULD create ONE category linked to the Personal scope and every accessible family', async () => {
    await setup.execute(allInput);

    expect(mocks.categoryRepository.createCategory).toHaveBeenCalledTimes(1);
    expect(mocks.categoryRepository.createCategory).toHaveBeenCalledWith({
      allScopes: true,
      creatorId: mocks.userId,
      depthLevel: 0,
      icon: 'store',
      iconColor: '#000000',
      name: 'Supermarket',
      owner: OwnerType.USER,
      ownerId: mocks.userId,
      parentId: undefined,
      scopes: allScopes,
      type: TransactionType.EXPENSE,
    });
  });

  it('SHOULD make a child of an ALL category ALL with the parent scopes AND creator', async () => {
    mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(allParent);

    await setup.execute({ ...allInput, parentId: 'all-parent' });

    expect(mocks.categoryRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        allScopes: true,
        creatorId: mocks.userId,
        depthLevel: 1,
        scopes: allParent.scopes,
      }),
    );
  });

  it.each([
    ['ALL under a single-scope parent', allInput, mocks.parent],
    ['single-scope under an ALL parent', mocks.input, allParent],
  ])('SHOULD throw BadRequest (400) WHEN creating %s', async (_label, input, parent) => {
    mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(parent);

    await expect(setup.execute({ ...input, parentId: 'p' })).rejects.toThrow(BadRequestException);
    expect(mocks.categoryRepository.createCategory).not.toHaveBeenCalled();
  });

  it('SHOULD throw a validation error WHEN a single-scope category has no ownerId', async () => {
    await expect(setup.execute({ ...mocks.input, ownerId: undefined } as never)).rejects.toThrow(
      ValidationError,
    );
  });
});
