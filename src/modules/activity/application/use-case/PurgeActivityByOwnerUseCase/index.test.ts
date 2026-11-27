import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { PurgeActivityByOwnerUseCase } from './index';

describe('PurgeActivityByOwnerUseCase', () => {
  it('SHOULD delete every entry of the owner AND return the count', async () => {
    const repository = { deleteByOwner: jest.fn().mockResolvedValue(3) };

    await expect(
      new PurgeActivityByOwnerUseCase(repository as never).execute({
        owner: OwnerType.FAMILY,
        ownerId: 'f-1',
      }),
    ).resolves.toBe(3);
    expect(repository.deleteByOwner).toHaveBeenCalledWith('FAMILY', 'f-1');
  });
});
