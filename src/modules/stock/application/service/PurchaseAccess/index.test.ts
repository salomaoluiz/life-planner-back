import { ConflictException, NotFoundException } from '@nestjs/common';

import {
  accessibleOwners,
  archivedOwners,
  purchase,
  purchaseRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import {
  CLOSING_LOCK_MS,
  ensureRowsWritable,
  isClosingLocked,
  loadReadablePurchase,
  loadWritablePurchase,
} from './index';

const repository = purchaseRepositoryMock();
const now = new Date('2026-11-18T12:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  repository.findById.mockResolvedValue(purchase('p'));
});

describe('loadReadablePurchase / loadWritablePurchase', () => {
  it('SHOULD answer 404 for a missing purchase or one of an unreachable owner', async () => {
    repository.findById.mockResolvedValue(undefined);
    await expect(loadReadablePurchase(repository, accessibleOwners, 'p')).rejects.toThrow(
      NotFoundException,
    );

    repository.findById.mockResolvedValue(purchase('p', { ownerId: 'stranger' }));
    await expect(loadReadablePurchase(repository, accessibleOwners, 'p')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD refuse writes (422) WHEN the family is archived', async () => {
    repository.findById.mockResolvedValue(
      purchase('p', { owner: 'FAMILY' as never, ownerId: 'family-id' }),
    );

    await expect(loadReadablePurchase(repository, archivedOwners, 'p')).resolves.toBeDefined();
    await expect(loadWritablePurchase(repository, archivedOwners, 'p')).rejects.toThrow();
  });
});

describe('isClosingLocked', () => {
  it('SHOULD hold for 15 minutes only', () => {
    function lock(ago: number) {
      return purchase('p', { closingAt: new Date(now.getTime() - ago), closingBy: 'u' });
    }

    expect(isClosingLocked(lock(CLOSING_LOCK_MS - 1), now)).toBe(true);
    expect(isClosingLocked(lock(CLOSING_LOCK_MS), now)).toBe(false);
    expect(isClosingLocked(purchase('p'), now)).toBe(false);
  });
});

describe('ensureRowsWritable', () => {
  it('SHOULD accept an open purchase AND the closer', () => {
    expect(() => ensureRowsWritable(purchase('p'), 'u', now)).not.toThrow();
    expect(() =>
      ensureRowsWritable(purchase('p', { closingAt: now, closingBy: 'u' }), 'u', now),
    ).not.toThrow();
  });

  it('SHOULD refuse (409) other statuses AND other closers', () => {
    expect(() =>
      ensureRowsWritable(purchase('p', { status: PurchaseStatuses.ENDED }), 'u', now),
    ).toThrow(ConflictException);
    expect(() =>
      ensureRowsWritable(purchase('p', { closingAt: now, closingBy: 'other' }), 'u', now),
    ).toThrow(ConflictException);
  });
});
