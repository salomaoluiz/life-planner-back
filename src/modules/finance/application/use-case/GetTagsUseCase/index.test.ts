import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

function tag(name: string, usage: number) {
  return new mocks.fixture().withName(name).withUsageCount(usage).build();
}

describe('GetTagsUseCase', () => {
  it('SHOULD sort by usage desc (unused last) then name WHEN one owner is asked', async () => {
    mocks.tagRepository.findTags.mockResolvedValue([
      tag('b', 0),
      tag('c', 5),
      tag('A', 5),
      tag('d', 2),
    ]);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: [mocks.personal.ownerId],
    });

    expect(result.map((item) => item.name)).toEqual(['A', 'c', 'd', 'b']);
    expect(mocks.tagRepository.findTags).toHaveBeenCalledWith({
      owners: [mocks.personal],
      q: undefined,
    });
  });

  it('SHOULD sort by name ignoring case WHEN several owners are asked', async () => {
    mocks.tagRepository.findTags.mockResolvedValue([tag('b', 9), tag('A', 0), tag('c', 1)]);

    const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, q: 'x' });

    expect(result.map((item) => item.name)).toEqual(['A', 'b', 'c']);
  });

  it('SHOULD answer 404 WHEN an owner is not accessible', async () => {
    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, ownerIds: ['stranger'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SHOULD return [] WHEN every family is archived and no owner is left', async () => {
    expect(await setup.execute({ accessibleOwners: [], ownerIds: undefined })).toEqual([]);
    expect(mocks.tagRepository.findTags).not.toHaveBeenCalled();
  });
});
