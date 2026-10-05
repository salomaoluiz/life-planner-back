import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD delete an accessible account', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id });

  expect(mocks.accountRepository.deleteAccount).toHaveBeenCalledWith(mocks.account.id);
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.account, ownerId: 'someone-else' }],
])(
  'SHOULD throw NotFound (404) AND delete nothing WHEN the account is %s',
  async (_label, found) => {
    mocks.accountRepository.findAccountById.mockResolvedValueOnce(found);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.account.id }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.accountRepository.deleteAccount).not.toHaveBeenCalled();
  },
);
