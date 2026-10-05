import { AccountStatus } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('createAccount', () => {
  it('SHOULD translate to snake_case columns AND map the result', async () => {
    const result = await setup.createAccount({
      balance: 10,
      icon: 'bank',
      name: 'Checking',
      owner: OwnerType.USER,
      ownerId: 'owner-id',
      status: AccountStatus.ACTIVE,
    });

    expect(mocks.accountDatasource.create).toHaveBeenCalledWith({
      balance: 10,
      icon: 'bank',
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

describe('updateAccount', () => {
  it('SHOULD forward only the editable fields AND map the result', async () => {
    const result = await setup.updateAccount({ id: 'id-1', name: 'New' });

    expect(mocks.accountDatasource.update).toHaveBeenCalledWith({
      balance: undefined,
      icon: undefined,
      id: 'id-1',
      name: 'New',
      status: undefined,
    });
    expect(result).toBe(mocks.accountEntity);
  });
});
