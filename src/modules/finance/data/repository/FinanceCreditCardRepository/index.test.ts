import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup, spies } from './index.mocks';

describe('createCreditCard', () => {
  it('SHOULD translate to snake_case columns AND map the result', async () => {
    const result = await setup.createCreditCard({
      brand: CreditCardBrand.VISA,
      closingDay: 31,
      color: '#3B5BDB',
      currency: 'BRL' as const,
      dueDay: 10,
      lastDigits: '1234',
      limit: 500000,
      owner: OwnerType.USER,
      ownerId: 'owner-id',
      paymentAccountId: 'account-1',
      paymentDay: 5,
      status: AccountStatus.ACTIVE,
      title: 'Main card',
    });

    expect(mocks.datasource.create).toHaveBeenCalledWith({
      brand: 'VISA',
      closing_day: 31,
      color: '#3B5BDB',
      currency: 'BRL' as const,
      due_day: 10,
      last_digits: '1234',
      limit: 500000,
      owner: 'USER',
      owner_id: 'owner-id',
      payment_account_id: 'account-1',
      payment_day: 5,
      status: 'ACTIVE',
      title: 'Main card',
    });
    expect(spies.mapper.toDomain).toHaveBeenCalledWith(mocks.persistence);
    expect(result).toBe(mocks.entity);
  });
});

describe('deleteCreditCard', () => {
  it('SHOULD delegate to the datasource', async () => {
    await setup.deleteCreditCard('id-1');

    expect(mocks.datasource.delete).toHaveBeenCalledWith('id-1');
  });
});

describe('existsByOwner', () => {
  it('SHOULD ask the datasource with snake_case columns', async () => {
    expect(await setup.existsByOwner({ owner: OwnerType.FAMILY, ownerId: 'fam' })).toBe(true);
    expect(mocks.datasource.exists).toHaveBeenCalledWith({ owner: 'FAMILY', owner_id: 'fam' });
  });
});

describe('findCreditCardById', () => {
  it('SHOULD map the row WHEN found AND return undefined WHEN not', async () => {
    expect(await setup.findCreditCardById('id-1')).toBe(mocks.entity);

    mocks.datasource.findById.mockResolvedValueOnce(null);
    expect(await setup.findCreditCardById('id-1')).toBeUndefined();
  });
});

describe('findCreditCards', () => {
  it('SHOULD pass owners AND status through AND map every row', async () => {
    const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];

    const result = await setup.findCreditCards(owners, AccountStatus.ACTIVE);

    expect(mocks.datasource.findByOwners).toHaveBeenCalledWith(owners, 'ACTIVE');
    expect(result).toEqual([mocks.entity]);
  });
});

describe('updateCreditCard', () => {
  it('SHOULD translate camelCase to columns keeping null (clear) AND map the result', async () => {
    const result = await setup.updateCreditCard({
      id: 'id-1',
      lastDigits: null,
      ownerId: 'new-owner',
      paymentAccountId: null,
      paymentDay: null,
    });

    expect(mocks.datasource.update).toHaveBeenCalledWith({
      brand: undefined,
      closing_day: undefined,
      color: undefined,
      due_day: undefined,
      id: 'id-1',
      last_digits: null,
      limit: undefined,
      owner: undefined,
      owner_id: 'new-owner',
      payment_account_id: null,
      payment_day: null,
      status: undefined,
      title: undefined,
    });
    expect(result).toBe(mocks.entity);
  });
});
