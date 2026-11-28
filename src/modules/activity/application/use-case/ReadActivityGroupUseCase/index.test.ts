import { ActivityGroupKind } from '@activity/domain/enum';

import { ReadActivityGroupUseCase } from './index';

describe('ReadActivityGroupUseCase', () => {
  it('SHOULD read the group through the repository', async () => {
    const repository = { readGroup: jest.fn().mockResolvedValue([{ label: 'a' }]) };

    await expect(
      new ReadActivityGroupUseCase(repository as never).execute({
        id: 'r-1',
        kind: ActivityGroupKind.RECURRENCE_ROWS,
      }),
    ).resolves.toEqual([{ label: 'a' }]);
    expect(repository.readGroup).toHaveBeenCalledWith('RECURRENCE_ROWS', 'r-1');
  });
});
