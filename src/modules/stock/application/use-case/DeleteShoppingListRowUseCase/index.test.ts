import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete the row on behalf of the user (the datasource records the dismissal)', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'r', userId: 'user-id' });

  expect(mocks.lists.deleteRow).toHaveBeenCalledWith('r', 'user-id');
});

it('SHOULD answer 404 WHEN the row is missing or the list unreachable', async () => {
  await expect(setup.execute({ accessibleOwners: [], id: 'r', userId: 'user-id' })).rejects.toThrow(
    NotFoundException,
  );
  mocks.lists.findRowById.mockResolvedValueOnce(undefined);
  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: 'r', userId: 'user-id' }),
  ).rejects.toThrow(NotFoundException);
  expect(mocks.lists.deleteRow).not.toHaveBeenCalled();
});
