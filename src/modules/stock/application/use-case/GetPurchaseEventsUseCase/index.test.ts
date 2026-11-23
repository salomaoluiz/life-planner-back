import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD read the events after the id for a readable list', async () => {
  mocks.purchases.findEventsAfter.mockResolvedValue([{ id: 5n }]);

  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    afterId: 4n,
    listId: 'list-id',
  });

  expect(result).toEqual([{ id: 5n }]);
  expect(mocks.purchases.findEventsAfter).toHaveBeenCalledWith('list-id', 4n, 500);
});

it('SHOULD answer 404 for a list the caller cannot read (the stream is never opened)', async () => {
  mocks.lists.findById.mockResolvedValue(undefined);

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, listId: 'list-id' }),
  ).rejects.toThrow(NotFoundException);
});
