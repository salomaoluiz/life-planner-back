import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';
import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { AccountStatus, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

async function run(id: string, patch: Record<string, unknown>) {
  return setup.execute({ accessibleOwners: mocks.accessibleOwners, id, ...patch } as never);
}

describe('plain field updates', () => {
  it('SHOULD update only name / icon / color, touching neither parent nor depth', async () => {
    const result = await run('a', { iconColor: '#2E7D32', name: ' Renamed ' });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith({
      depthLevel: undefined,
      icon: undefined,
      iconColor: '#2E7D32',
      id: 'a',
      name: 'Renamed',
      parentId: undefined,
      subtreeDepths: undefined,
      type: undefined,
    });
    expect(result).toBe(mocks.updated);
  });

  it('SHOULD treat parentId equal to the current parent as a no-op for the tree', async () => {
    await run('b', { name: 'x', parentId: 'a' });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        depthLevel: undefined,
        parentId: undefined,
        subtreeDepths: undefined,
      }),
    );
  });
});

describe('moving a category', () => {
  it('SHOULD make a category a root with parentId null AND recompute the WHOLE subtree depth', async () => {
    await run('b', { parentId: null });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        depthLevel: 0,
        id: 'b',
        parentId: null,
        subtreeDepths: [{ depthLevel: 1, id: 'c' }],
      }),
    );
  });

  it('SHOULD recompute every descendant depth, not only direct children (a under e: a=2, b=3, c=4)', async () => {
    await run('a', { parentId: 'e' });

    const call = mocks.categoryRepository.updateCategory.mock.calls[0][0];
    expect(call.depthLevel).toBe(2);
    expect(call.parentId).toBe('e');
    expect(call.subtreeDepths).toEqual(
      expect.arrayContaining([
        { depthLevel: 3, id: 'b' },
        { depthLevel: 4, id: 'c' },
      ]),
    );
    expect(call.subtreeDepths).toHaveLength(2);
  });

  it('SHOULD NOT send subtree updates WHEN the depth does not change (b moved under d: depth 1 -> 1)', async () => {
    await run('b', { parentId: 'd' });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ depthLevel: 1, parentId: 'd', subtreeDepths: undefined }),
    );
  });

  it.each([
    ['itself', 'a'],
    ['its child', 'b'],
    ['its grandchild (deep cycle)', 'c'],
  ])('SHOULD throw BadRequest (400) WHEN a is moved under %s', async (_label, parentId) => {
    await expect(run('a', { parentId })).rejects.toThrow(BadRequestException);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it.each([
    ['does not exist', 'nope'],
    ['belongs to a stranger', 'x'],
  ])('SHOULD throw NotFound (404) WHEN the new parent %s', async (_label, parentId) => {
    await expect(run('d', { parentId })).rejects.toThrow(NotFoundException);
  });

  it('SHOULD throw BadRequest (400) WHEN the new parent is accessible but has another owner', async () => {
    await expect(run('d', { parentId: 'f' })).rejects.toThrow(BadRequestException);
  });

  it('SHOULD throw BadRequest (400) WHEN the new parent has another type', async () => {
    await expect(run('d', { parentId: 'i' })).rejects.toThrow(BadRequestException);
  });
});

describe('changing the type', () => {
  it('SHOULD allow it for a root without children', async () => {
    await run('i', { type: TransactionType.EXPENSE });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i', type: TransactionType.EXPENSE }),
    );
  });

  it('SHOULD throw Conflict (409) WHEN the childless root already has transactions', async () => {
    mocks.transactionRepository.countByCategoryIds.mockResolvedValueOnce(2);

    await expect(run('i', { type: TransactionType.EXPENSE })).rejects.toThrow(ConflictException);
    expect(mocks.transactionRepository.countByCategoryIds).toHaveBeenCalledWith(['i']);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it('SHOULD NOT count transactions WHEN the type does not change', async () => {
    await run('i', { name: 'Renamed' });

    expect(mocks.transactionRepository.countByCategoryIds).not.toHaveBeenCalled();
  });

  it.each([
    ['has children', 'a'],
    ['has a parent (not moved in the same patch)', 'e'],
  ])('SHOULD throw Conflict (409) WHEN the category %s', async (_label, id) => {
    await expect(run(id, { type: TransactionType.INCOME })).rejects.toThrow(ConflictException);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it('SHOULD allow it WHEN the same patch detaches a leaf from its parent', async () => {
    await run('e', { parentId: null, type: TransactionType.INCOME });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        depthLevel: 0,
        id: 'e',
        parentId: null,
        type: TransactionType.INCOME,
      }),
    );
  });
});

describe('access and validation', () => {
  it.each([
    ['does not exist', 'nope'],
    ['belongs to a stranger', 'x'],
  ])('SHOULD throw NotFound (404) WHEN the category %s', async (_label, id) => {
    await expect(run(id, { name: 'x' })).rejects.toThrow(NotFoundException);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty patch', {}],
    ['null on a required field', { name: null }],
    ['an invalid color', { iconColor: 'blue' }],
    ['a whitespace-only name', { name: ' ' }],
    ['an unknown type', { type: 'X' }],
  ])('SHOULD throw ValidationError WHEN the patch is %s', async (_label, patch) => {
    await expect(run('a', patch)).rejects.toThrow(ValidationError);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });
});

describe('system categories (spec 028)', () => {
  const systemId = SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT];

  it('SHOULD throw Unprocessable (422) "System categories cannot be changed" BEFORE any lookup', async () => {
    await expect(run(systemId, { name: 'x' })).rejects.toThrow(
      new UnprocessableEntityException('System categories cannot be changed'),
    );
    expect(mocks.categoryRepository.findCategoryById).not.toHaveBeenCalled();
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it('SHOULD throw Unprocessable (422) WHEN moving a category under a system category', async () => {
    await expect(run('a', { parentId: systemId })).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });
});

describe('ALL scope', () => {
  const family = { owner: OwnerType.FAMILY, ownerId: 'family-id' };
  const allScopes = [{ owner: OwnerType.USER, ownerId: mocks.userId }, family];
  const allRoot = new CategoryEntityFixture()
    .withId('all-root')
    .withAllScopes(allScopes, mocks.userId)
    .build();
  const allChild = new CategoryEntityFixture()
    .withId('all-child')
    .withAllScopes(allScopes, mocks.userId)
    .withParentId('all-root')
    .withDepthLevel(1)
    .build();

  async function runAll(id: string, patch: Record<string, unknown>) {
    return run(id, { callerId: mocks.userId, ...patch });
  }

  it('SHOULD switch a root to ALL with its WHOLE subtree, the caller as creator and their accessible scopes', async () => {
    await runAll('a', { scope: 'ALL' });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a',
        scope: {
          creatorId: mocks.userId,
          scopes: mocks.accessibleOwners,
          subtreeIds: ['b', 'c'],
        },
      }),
    );
  });

  it('SHOULD refuse (400) to switch a category that has a parent', async () => {
    await expect(runAll('b', { scope: 'ALL' })).rejects.toThrow(BadRequestException);
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it('SHOULD refuse (400) to switch to ALL while moving under a parent', async () => {
    await expect(runAll('d', { parentId: 'a', scope: 'ALL' })).rejects.toThrow(BadRequestException);
  });

  it('SHOULD treat scope ALL on an ALL category as a no-op for the scopes', async () => {
    mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(allRoot);
    mocks.categoryRepository.findCategories.mockResolvedValue([allRoot, allChild]);

    await runAll('all-root', { name: 'Renamed', scope: 'ALL' });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ scope: undefined }),
    );
  });

  it('SHOULD refuse (400) to move a single-scope category under an ALL parent', async () => {
    mocks.categoryRepository.findCategoryById
      .mockResolvedValueOnce(mocks.nodes.d)
      .mockResolvedValueOnce(allRoot);

    await expect(runAll('d', { parentId: 'all-root' })).rejects.toThrow(BadRequestException);
  });

  it('SHOULD refuse (400) to move an ALL category under a single-scope parent', async () => {
    mocks.categoryRepository.findCategoryById
      .mockResolvedValueOnce(allChild)
      .mockResolvedValueOnce(mocks.nodes.a);
    mocks.categoryRepository.findCategories.mockResolvedValue([allRoot, allChild]);

    await expect(runAll('all-child', { parentId: 'a' })).rejects.toThrow(BadRequestException);
  });

  it('SHOULD reject a scope other than ALL (there is no way back)', async () => {
    await expect(runAll('all-root', { scope: 'PERSONAL' })).rejects.toThrow(ValidationError);
  });
});

describe('archiving (spec 041)', () => {
  it('SHOULD archive a parent together with every descendant', async () => {
    await run('a', { status: AccountStatus.ARCHIVED });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a',
        status: AccountStatus.ARCHIVED,
        subtreeIds: ['b', 'c'],
      }),
    );
  });

  it('SHOULD archive a single child alone', async () => {
    await run('c', { status: AccountStatus.ARCHIVED });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c', status: AccountStatus.ARCHIVED, subtreeIds: [] }),
    );
  });

  it('SHOULD reactivate a parent with every descendant', async () => {
    mocks.categoryRepository.findCategoryById.mockImplementation(async (id: string) => ({
      ...[mocks.nodes.a, mocks.nodes.b, mocks.nodes.c].find((node) => node.id === id),
      status: AccountStatus.ARCHIVED,
    }));

    await run('a', { status: AccountStatus.ACTIVE });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a', status: AccountStatus.ACTIVE, subtreeIds: ['b', 'c'] }),
    );
  });

  it('SHOULD refuse (422) to reactivate a child whose parent is archived', async () => {
    mocks.categoryRepository.findCategoryById.mockImplementation(async (id: string) => ({
      ...[mocks.nodes.a, mocks.nodes.b].find((node) => node.id === id),
      status: AccountStatus.ARCHIVED,
    }));

    await expect(run('b', { status: AccountStatus.ACTIVE })).rejects.toThrow(
      new UnprocessableEntityException('Parent category is archived'),
    );
    expect(mocks.categoryRepository.updateCategory).not.toHaveBeenCalled();
  });

  it('SHOULD NOT send a status WHEN it equals the current one', async () => {
    await run('a', { name: 'Renamed', status: AccountStatus.ACTIVE });

    expect(mocks.categoryRepository.updateCategory).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, subtreeIds: undefined }),
    );
  });

  it('SHOULD refuse (422) to archive a system category', async () => {
    await expect(
      run(SYSTEM_CATEGORY_IDS[SystemCategoryKey.BALANCE_ADJUSTMENT], {
        status: AccountStatus.ARCHIVED,
      }),
    ).rejects.toThrow(new UnprocessableEntityException('System categories cannot be archived'));
  });

  it('SHOULD refuse (422) to move a category under an archived parent', async () => {
    mocks.categoryRepository.findCategoryById.mockImplementation(async (id: string) => ({
      ...[mocks.nodes.a, mocks.nodes.d, mocks.nodes.e].find((node) => node.id === id),
      status: id === 'a' ? AccountStatus.ARCHIVED : AccountStatus.ACTIVE,
    }));

    await expect(run('d', { parentId: 'a' })).rejects.toThrow(
      new UnprocessableEntityException('Parent category is archived'),
    );
  });
});
