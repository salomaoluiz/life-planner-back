import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD return false WHEN the owner has no account, category or transaction', async () => {
  expect(await setup.execute(mocks.input)).toBe(false);
});

it.each([
  ['an account', 'accountRepository'],
  ['a category', 'categoryRepository'],
  ['a transaction', 'transactionRepository'],
] as const)('SHOULD return true WHEN the owner has only %s', async (_label, repository) => {
  mocks[repository].existsByOwner.mockResolvedValueOnce(true);

  expect(await setup.execute(mocks.input)).toBe(true);
});

it('SHOULD ask each repository about exactly that owner (other owners data does not count)', async () => {
  await setup.execute(mocks.input);

  for (const repository of [
    mocks.accountRepository,
    mocks.categoryRepository,
    mocks.transactionRepository,
  ]) {
    expect(repository.existsByOwner).toHaveBeenCalledTimes(1);
    expect(repository.existsByOwner).toHaveBeenCalledWith(mocks.input);
  }
});

it('SHOULD propagate a repository failure (the family delete must fail closed, never silently allow)', async () => {
  mocks.transactionRepository.existsByOwner.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});

it('SHOULD throw ValidationError WHEN the owner is invalid', async () => {
  await expect(setup.execute({ owner: 'GROUP', ownerId: 'x' } as never)).rejects.toThrow(
    ValidationError,
  );
});
