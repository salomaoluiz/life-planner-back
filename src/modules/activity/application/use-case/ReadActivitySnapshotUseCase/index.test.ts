import { ActivityEntityType } from '@activity/domain/enum';

import { ReadActivitySnapshotUseCase } from './index';

describe('ReadActivitySnapshotUseCase', () => {
  it('SHOULD read the item through the repository', async () => {
    const repository = { read: jest.fn().mockResolvedValue({ label: 'Mercado' }) };

    await expect(
      new ReadActivitySnapshotUseCase(repository as never).execute({
        entityType: ActivityEntityType.TRANSACTION,
        id: 't-1',
      }),
    ).resolves.toEqual({ label: 'Mercado' });
    expect(repository.read).toHaveBeenCalledWith('TRANSACTION', 't-1');
  });
});
