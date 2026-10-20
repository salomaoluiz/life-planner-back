import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

import {
  AdjustAccountBalanceApiSchema,
  CreateAccountApiSchema,
  UpdateAccountApiSchema,
} from './account.dto';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const valid = { icon: 'bank', name: 'Checking', owner: 'USER', ownerId };

describe('CreateAccountApiSchema', () => {
  it('SHOULD default initialBalance to 0 AND status to ACTIVE, trimming strings', () => {
    const result = CreateAccountApiSchema.parse({ ...valid, name: '  Checking ' });

    expect(result).toEqual({
      currency: 'BRL' as const,
      ...valid,
      initialBalance: 0,
      status: AccountStatus.ACTIVE,
    });
  });

  it('SHOULD accept the int4 bounds', () => {
    expect(CreateAccountApiSchema.safeParse({ ...valid, initialBalance: INT4_MAX }).success).toBe(
      true,
    );
    expect(CreateAccountApiSchema.safeParse({ ...valid, initialBalance: INT4_MIN }).success).toBe(
      true,
    );
  });

  it.each([
    ['12.5', { initialBalance: 12.5 }],
    ['"100"', { initialBalance: '100' }],
    ['above int4', { initialBalance: INT4_MAX + 1 }],
    ['below int4', { initialBalance: INT4_MIN - 1 }],
    ['the removed balance field', { balance: 10 }],
    ['empty name', { name: '' }],
    ['whitespace name', { name: '   ' }],
    ['61-char name', { name: 'a'.repeat(61) }],
    ['51-char icon', { icon: 'a'.repeat(51) }],
    ['non-uuid ownerId', { ownerId: 'abc' }],
    ['unknown owner', { owner: 'GROUP' }],
    ['unknown status', { status: 'DELETED' }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateAccountApiSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('UpdateAccountApiSchema', () => {
  it('SHOULD accept any subset of icon / name / status', () => {
    expect(UpdateAccountApiSchema.parse({ name: ' New ' })).toEqual({ name: 'New' });
    expect(UpdateAccountApiSchema.parse({ icon: 'cash', status: 'ARCHIVED' })).toEqual({
      icon: 'cash',
      status: 'ARCHIVED',
    });
  });

  it.each([
    ['an empty body', {}],
    ['owner', { owner: 'USER' }],
    ['ownerId', { ownerId }],
    ['an unknown key', { foo: 1 }],
    ['null on a required field', { name: null }],
    ['a whitespace-only name', { name: '  ' }],
    ['balance', { balance: 10 }],
    ['initialBalance', { initialBalance: 10 }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateAccountApiSchema.safeParse(body).success).toBe(false);
  });
});

it('SHOULD accept only an integer target for the balance adjustment AND reject extra keys', () => {
  expect(AdjustAccountBalanceApiSchema.parse({ balance: -1500 })).toEqual({ balance: -1500 });
  expect(AdjustAccountBalanceApiSchema.safeParse({ balance: 1.5 }).success).toBe(false);
  expect(AdjustAccountBalanceApiSchema.safeParse({}).success).toBe(false);
  expect(AdjustAccountBalanceApiSchema.safeParse({ balance: 1, extra: 1 }).success).toBe(false);
});

describe('currency (spec 040)', () => {
  it('SHOULD accept a supported currency on create AND reject an unknown one', () => {
    expect(CreateAccountApiSchema.parse({ ...valid, currency: 'USD' }).currency).toBe('USD');
    expect(CreateAccountApiSchema.safeParse({ ...valid, currency: 'XYZ' }).success).toBe(false);
    expect(CreateAccountApiSchema.safeParse({ ...valid, currency: 'usd' }).success).toBe(false);
  });

  it('SHOULD reject currency on PATCH, even the same one', () => {
    expect(UpdateAccountApiSchema.safeParse({ currency: 'BRL' }).success).toBe(false);
    expect(UpdateAccountApiSchema.safeParse({ currency: 'BRL', name: 'x' }).success).toBe(false);
  });
});
