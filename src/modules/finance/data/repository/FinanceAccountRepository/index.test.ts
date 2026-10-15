import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('createAccount', () => {
  it('SHOULD translate to snake_case columns AND map the result', async () => {
    const result = await setup.createAccount({
      icon: 'bank',
      initialBalance: 10,
      name: 'Checking',
      owner: OwnerType.USER,
      ownerId: 'owner-id',
      status: AccountStatus.ACTIVE,
    });

    expect(mocks.accountDatasource.create).toHaveBeenCalledWith({
      icon: 'bank',
      initial_balance: 10,
      ledger_balance: 10,
      name: 'Checking',
      owner: 'USER',
      owner_id: 'owner-id',
      status: 'ACTIVE',
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.accountPersistence);
    expect(result).toBe(mocks.accountEntity);
  });
});

describe('deleteAccount', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteAccount('id-1');

    expect(mocks.accountDatasource.delete).toHaveBeenCalledWith('id-1');
  });
});

describe('existsByOwner', () => {
  it('SHOULD ask the datasource with snake_case columns', async () => {
    const result = await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'fam' });

    expect(mocks.accountDatasource.exists).toHaveBeenCalledWith({
      owner: 'FAMILY',
      owner_id: 'fam',
    });
    expect(result).toBe(true);
  });
});

describe('findAccountById', () => {
  it('SHOULD map the row WHEN found', async () => {
    expect(await setup.findAccountById('id-1')).toBe(mocks.accountEntity);
  });

  it('SHOULD return undefined WHEN not found', async () => {
    mocks.accountDatasource.findById.mockResolvedValueOnce(null);

    expect(await setup.findAccountById('id-1')).toBeUndefined();
    expect(spies.mapper.toDomain).not.toHaveBeenCalled();
  });
});

describe('findAccounts', () => {
  it('SHOULD map every row', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    const result = await setup.findAccounts(owners);

    expect(mocks.accountDatasource.findByOwners).toHaveBeenCalledWith(owners);
    expect(result).toEqual([mocks.accountEntity]);
  });
});

describe('findFutureSums', () => {
  it("SHOULD pass the end of today's month to the datasource AND map the rows to camelCase", async () => {
    mocks.accountDatasource.findFutureSums.mockResolvedValue([
      { account_id: 'acc-1', after_end_of_month: -400, after_today: 600 },
    ]);

    const result = await setup.findFutureSums({ accountIds: ['acc-1'], today: '2026-02-10' });

    expect(mocks.accountDatasource.findFutureSums).toHaveBeenCalledWith({
      account_ids: ['acc-1'],
      end_of_month: '2026-02-28',
      today: '2026-02-10',
    });
    expect(result).toEqual([{ accountId: 'acc-1', afterEndOfMonth: -400, afterToday: 600 }]);
  });
});

describe('updateAccount', () => {
  it('SHOULD forward only the editable fields AND map the result', async () => {
    const result = await setup.updateAccount({ id: 'id-1', name: 'New' });

    expect(mocks.accountDatasource.update).toHaveBeenCalledWith({
      icon: undefined,
      id: 'id-1',
      name: 'New',
      status: undefined,
    });
    expect(result).toBe(mocks.accountEntity);
  });
});
