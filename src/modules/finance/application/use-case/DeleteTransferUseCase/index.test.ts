import { UnprocessableEntityException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD delete the transfer WHEN both owners are writable', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id });

  expect(spies.transferRepository.deleteTransfer).toHaveBeenCalledWith(mocks.transfer.id);
});

it('SHOULD refuse WHEN one family is archived AND delete nothing', async () => {
  const archived = mocks.accessibleOwners.map((owner, index) =>
    index === 0 ? { ...owner, archived: true } : owner,
  );

  await expect(
    setup.execute({ accessibleOwners: archived, id: mocks.transfer.id }),
  ).rejects.toThrow(UnprocessableEntityException);
  expect(spies.transferRepository.deleteTransfer).not.toHaveBeenCalled();
});

it('SHOULD not delete WHEN the transfer is not readable', async () => {
  spies.getTransfer.execute.mockRejectedValueOnce(new Error('Transfer not found'));

  await expect(
    setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.transfer.id }),
  ).rejects.toThrow('Transfer not found');
  expect(spies.transferRepository.deleteTransfer).not.toHaveBeenCalled();
});
