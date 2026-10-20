import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

describe('DeleteTagUseCase', () => {
  it('SHOULD delete the tag even WHEN it is in use (its links go with it)', async () => {
    await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.tag.id });

    expect(mocks.tagRepository.deleteTag).toHaveBeenCalledWith(mocks.tag.id);
  });

  it('SHOULD answer 404 WHEN the tag is missing or not visible', async () => {
    mocks.tagRepository.findTagById.mockResolvedValueOnce(undefined);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'x' }),
    ).rejects.toThrow(NotFoundException);
    await expect(setup.execute({ accessibleOwners: [], id: mocks.tag.id })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD answer 422 WHEN the owner family is archived', async () => {
    const tag = {
      ...mocks.tag,
      owner: 'FAMILY' as const,
      scopes: [{ owner: 'FAMILY' as const, ownerId: mocks.tag.ownerId }],
    };
    mocks.tagRepository.findTagById.mockResolvedValue(tag);

    await expect(
      setup.execute({
        accessibleOwners: [
          { archived: true, owner: 'FAMILY' as never, ownerId: mocks.tag.ownerId },
        ],
        id: tag.id,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});
