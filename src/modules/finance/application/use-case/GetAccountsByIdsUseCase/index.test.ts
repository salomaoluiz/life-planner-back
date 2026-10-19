import { mocks, setup } from './index.mocks';

describe('GetAccountsByIdsUseCase', () => {
  it('SHOULD return only the accounts the caller can access, querying unique ids once', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      ids: [mocks.own.id, mocks.own.id, mocks.other.id],
    });

    expect(mocks.accountRepository.findAccountsByIds).toHaveBeenCalledWith([
      mocks.own.id,
      mocks.other.id,
    ]);
    expect(result).toEqual([mocks.own]);
  });

  it('SHOULD not query WHEN there are no ids', async () => {
    expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, ids: [] })).toEqual([]);
    expect(mocks.accountRepository.findAccountsByIds).not.toHaveBeenCalled();
  });
});
