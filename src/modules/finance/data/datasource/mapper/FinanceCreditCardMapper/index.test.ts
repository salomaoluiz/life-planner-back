import { FinanceCreditCardMapper } from './index';
import { mocks } from './index.mocks';

describe('FinanceCreditCardMapper', () => {
  describe('toDomain', () => {
    it('SHOULD map every column to the entity', () => {
      expect(FinanceCreditCardMapper.toDomain(mocks.raw)).toEqual({
        brand: 'MASTERCARD',
        closingDay: 31,
        color: '#3B5BDB',
        createdAt: mocks.raw.created_at,
        currency: 'BRL' as const,
        dueDay: 10,
        id: mocks.raw.id,
        lastDigits: '9876',
        limit: 500000,
        owner: 'FAMILY',
        ownerId: mocks.raw.owner_id,
        paymentAccountId: mocks.raw.payment_account_id,
        paymentDay: 5,
        status: 'ARCHIVED',
        title: 'Travel',
        updatedAt: mocks.raw.updated_at,
      });
    });

    it('SHOULD turn null payment_day and last_digits into undefined', () => {
      const result = FinanceCreditCardMapper.toDomain({
        ...mocks.raw,
        last_digits: null,
        payment_account_id: null,
        payment_day: null,
      });

      expect(result.paymentAccountId).toBeUndefined();
      expect(result.paymentDay).toBeUndefined();
      expect(result.lastDigits).toBeUndefined();
    });
  });
});
