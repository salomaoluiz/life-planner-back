import { ConflictException, NotFoundException } from '@nestjs/common';

import { location } from '@stock/application/mocks/stock.mocks';

import { mocks, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, id: 'a' };

beforeEach(() => {
  mocks.catalog.findLocationById.mockResolvedValue(location('a'));
});

it('SHOULD delete a location nobody uses', async () => {
  await setup.execute(input);

  expect(mocks.catalog.deleteLocation).toHaveBeenCalledWith('a');
});

it('SHOULD answer 409 with the item count WHEN items use it', async () => {
  mocks.catalog.countItemsByLocation.mockResolvedValue(new Map([['a', 2]]));

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
