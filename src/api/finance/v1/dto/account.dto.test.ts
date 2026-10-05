import { INT4_MAX, INT4_MIN } from '@finance/application/dto/FinanceCommon';
import { AccountStatus } from '@finance/domain/enum';

import { CreateAccountApiSchema, UpdateAccountApiSchema } from './account.dto';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const valid = { icon: 'bank', name: 'Checking', owner: 'USER', ownerId };

describe('CreateAccountApiSchema', () => {
  it('SHOULD default balance to 0 AND status to ACTIVE, trimming strings', () => {
    const result = CreateAccountApiSchema.parse({ ...valid, name: '  Checking ' });

    expect(result).toEqual({ ...valid, balance: 0, status: AccountStatus.ACTIVE });
  });

  it('SHOULD accept the int4 bounds', () => {
    expect(CreateAccountApiSchema.safeParse({ ...valid, balance: INT4_MAX }).success).toBe(true);
    expect(CreateAccountApiSchema.safeParse({ ...valid, balance: INT4_MIN }).success).toBe(true);
  });

  it.each([
    ['12.5', { balance: 12.5 }],
    ['"100"', { balance: '100' }],
    ['above int4', { balance: INT4_MAX + 1 }],
    ['below int4', { balance: INT4_MIN - 1 }],
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
  it('SHOULD accept any subset of balance / icon / name / status', () => {
    expect(UpdateAccountApiSchema.parse({ name: ' New ' })).toEqual({ name: 'New' });
    expect(UpdateAccountApiSchema.parse({ balance: -1, status: 'ARCHIVED' })).toEqual({
      balance: -1,
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
    ['a non-integer balance', { balance: 0.1 }],
    ['a balance above int4', { balance: INT4_MAX + 1 }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateAccountApiSchema.safeParse(body).success).toBe(false);
  });
});
