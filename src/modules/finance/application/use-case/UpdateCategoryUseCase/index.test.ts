import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { TransactionType } from '@finance/domain/enum';
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
