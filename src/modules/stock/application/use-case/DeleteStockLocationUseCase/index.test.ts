import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, id: 'a' };

beforeEach(() => {
  mocks.catalog.findLocationById.mockResolvedValue(location('a'));
  mocks.catalog.findLocations.mockResolvedValue([
    location('a'),
    location('sub', { parentId: 'a' }),
    location('b'),
  ]);
});

it('SHOULD delete a location nobody uses', async () => {
  await setup.execute(input);

  expect(mocks.catalog.deleteLocation).toHaveBeenCalledWith('a', undefined);
});

it('SHOULD answer 409 with the item count WHEN items use it', async () => {
  mocks.catalog.countItemsByLocation.mockResolvedValue(
    new Map([
      ['a', 1],
      ['sub', 1],
    ]),
  );

  const error = await setup.execute(input).catch((caught) => caught);

  expect(error).toBeInstanceOf(ConflictException);
  expect(error.getResponse()).toMatchObject({ itemCount: 2 });
});

it('SHOULD answer 404 WHEN missing or of another owner', async () => {
  mocks.catalog.findLocationById.mockResolvedValue(undefined);
  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);

  mocks.catalog.findLocationById.mockResolvedValue(location('a', { ownerId: 'other' }));
  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});

describe('WHEN items of the subtree use it', () => {
  beforeEach(() => {
    mocks.catalog.countItemsByLocation.mockResolvedValue(new Map([['sub', 3]]));
  });

  it('SHOULD move the items to the target and delete the subtree', async () => {
    await setup.execute({ ...input, moveTo: 'b' });

    expect(mocks.catalog.deleteLocation).toHaveBeenCalledWith('a', { from: ['a', 'sub'], to: 'b' });
  });

  it('SHOULD leave the items without a location WHEN moveTo is none', async () => {
    await setup.execute({ ...input, moveTo: 'none' });

    expect(mocks.catalog.deleteLocation).toHaveBeenCalledWith('a', {
      from: ['a', 'sub'],
      to: null,
    });
  });

  it('SHOULD refuse a target inside the subtree with 422', async () => {
    await expect(setup.execute({ ...input, moveTo: 'sub' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
