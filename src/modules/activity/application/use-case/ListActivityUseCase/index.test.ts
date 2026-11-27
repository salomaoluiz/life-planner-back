import { ForbiddenException } from '@nestjs/common';

import { ActivityEntityType, ActivityModule } from '@activity/domain/enum';
import { encodeActivityCursor } from '@activity/domain/service/ActivityCursor';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { ListActivityUseCase } from './index';

const repository = { existingRefs: jest.fn(), list: jest.fn() };
const setup = new ListActivityUseCase(repository as never);
const now = new Date('2026-11-27T12:00:00Z');
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: 'u-1' },
  { owner: OwnerType.FAMILY, ownerId: 'f-1' },
];
const base = { accessibleOwners, module: ActivityModule.FINANCE, now, retentionDays: 183 };

function entry(id: string, overrides: object = {}) {
  return {
    action: 'CREATE',
    batch: false,
    entityId: `e-${id}`,
    entityType: ActivityEntityType.TRANSACTION,
    id,
    occurredAt: new Date('2026-11-24T10:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  repository.list.mockResolvedValue({ hasMore: false, rows: [] });
  repository.existingRefs.mockResolvedValue(new Set());
});

describe('ListActivityUseCase', () => {
  it('SHOULD default to the last 30 days AND read every owner of the user', async () => {
    await setup.execute(base);

    const [filter, size] = repository.list.mock.calls[0];

    expect(size).toBe(50);
    expect(filter.from).toEqual(new Date('2026-10-28T12:00:00Z'));
    expect(filter.to).toEqual(now);
    expect(filter.owners).toEqual([
      { ownerId: 'u-1', ownerType: 'USER' },
      { ownerId: 'f-1', ownerType: 'FAMILY' },
    ]);
  });

  it('SHOULD clamp a range older than the retention window', async () => {
    await setup.execute({ ...base, from: new Date('2020-01-01T00:00:00Z') });

    expect(repository.list.mock.calls[0][0].from).toEqual(new Date('2026-05-28T12:00:00Z'));
  });

  it('SHOULD refuse from after to with a validation error', async () => {
    await expect(
      setup.execute({ ...base, from: new Date('2026-11-20'), to: new Date('2026-11-10') }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('SHOULD answer 403 WHEN ownerId is not readable AND narrow to it WHEN it is', async () => {
    await expect(setup.execute({ ...base, ownerId: 'x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await setup.execute({ ...base, ownerId: 'f-1' });

    expect(repository.list.mock.calls[0][0].owners).toEqual([
      { ownerId: 'f-1', ownerType: 'FAMILY' },
    ]);
  });

  it('SHOULD reject a cursor that is not ours', async () => {
    await expect(setup.execute({ ...base, cursor: 'zzz' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('SHOULD compute itemExists with one existence query per page, never for deletes or batches', async () => {
    repository.list.mockResolvedValue({
      hasMore: true,
      rows: [
        entry('1'),
        entry('2', { action: 'DELETE' }),
        entry('3', {
          batch: true,
          entityId: null,
          entityType: ActivityEntityType.TRANSACTION_IMPORT,
        }),
        entry('4', { entityId: 'gone' }),
      ],
    });
    repository.existingRefs.mockResolvedValue(new Set(['TRANSACTION:e-1', 'TRANSACTION:e-2']));

    const result = await setup.execute(base);

    expect(repository.existingRefs).toHaveBeenCalledTimes(1);
    expect(result.items.map((item) => item.itemExists)).toEqual([true, false, false, false]);
    expect(result.nextCursor).toBe(
      encodeActivityCursor({ id: '4', occurredAt: new Date('2026-11-24T10:00:00Z') }),
    );
  });
});
