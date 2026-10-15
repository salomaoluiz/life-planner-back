import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { AccountController } from './account.controller';
import { mocks, setup } from './account.controller.mocks';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const validBody = { icon: 'bank', name: 'Checking', owner: 'USER', ownerId };

it('SHOULD be served at /finance/accounts under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, AccountController)).toBe('finance/accounts');
  expect(Reflect.getMetadata(VERSION_METADATA, AccountController)).toBe('1');
});

describe('findAll', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('SHOULD list the accounts of the JWT user with the client today', async () => {
    const result = await setup.findAll(mocks.request, { today: '2026-10-16' });

    expect(mocks.accountService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      '2026-10-16',
    );
    expect(result).toEqual([mocks.account]);
  });

  it('SHOULD fall back to the server UTC date WHEN today is not sent', async () => {
    await setup.findAll(mocks.request, {});

    expect(mocks.accountService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      '2026-10-15',
    );
  });

  it.each([
    ['a single ownerId', ownerId, [ownerId]],
    ['repeated ownerIds', [ownerId, ownerId], [ownerId, ownerId]],
  ])('SHOULD pass %s to the service as an array', async (_label, query, expected) => {
    await setup.findAll(mocks.request, { ownerId: query });

    expect(mocks.accountService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      expected,
      '2026-10-15',
    );
  });

  it.each([
    ['an ownerId that is not a uuid', { ownerId: 'abc' }],
    ['an impossible today', { today: '2026-02-30' }],
    ['a today with a time', { today: '2026-10-15T10:00:00Z' }],
  ])('SHOULD throw ValidationError (400) WHEN the query has %s', async (_label, query) => {
    await expect(setup.findAll(mocks.request, query)).rejects.toThrow(ValidationError);
    expect(mocks.accountService.findAll).not.toHaveBeenCalled();
  });
});

describe('create', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('SHOULD validate the body (defaults applied) AND call the service with the JWT user and the server date', async () => {
    const result = await setup.create(mocks.request, validBody as never);

    expect(mocks.accountService.create).toHaveBeenCalledWith(
      mocks.request.user.id,
      { ...validBody, initialBalance: 0, status: 'ACTIVE' },
      '2026-10-15',
    );
    expect(result).toEqual(mocks.account);
  });

  it.each([
    ['a missing body', undefined],
    ['the removed balance field', { ...validBody, balance: 100 }],
    ['a fractional initial balance', { ...validBody, initialBalance: 12.5 }],
    ['a missing owner', { icon: 'bank', name: 'x', ownerId }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.accountService.create).not.toHaveBeenCalled();
  });
});

describe('adjustBalance', () => {
  const route = { balance: 120000 };

  it('SHOULD validate the body AND the query, then call the service with the target and today', async () => {
    const result = await setup.adjustBalance(
      mocks.request,
      mocks.account.id,
      { today: '2026-10-15' },
      route as never,
    );

    expect(mocks.accountService.adjustBalance).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.account.id,
      120000,
      '2026-10-15',
    );
    expect(result).toEqual(mocks.account);
  });

  it.each([
    ['a missing balance', {}],
    ['a fractional balance', { balance: 1.5 }],
    ['an unknown key', { balance: 1, initialBalance: 1 }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, body) => {
    await expect(
      setup.adjustBalance(mocks.request, mocks.account.id, {}, body as never),
    ).rejects.toThrow(ValidationError);
    expect(mocks.accountService.adjustBalance).not.toHaveBeenCalled();
  });

  it('SHOULD throw ValidationError (400) WHEN today is not a calendar date', async () => {
    await expect(
      setup.adjustBalance(mocks.request, mocks.account.id, { today: 'tomorrow' }, route as never),
    ).rejects.toThrow(ValidationError);
  });

  it('SHOULD be served as POST /finance/accounts/:id/balance-adjustment answering 200', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AccountController.prototype.adjustBalance)).toBe(
      ':id/balance-adjustment',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AccountController.prototype.adjustBalance)).toBe(
      200,
    );
  });
});

describe('update', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('SHOULD validate the patch AND call the service', async () => {
    await setup.update(mocks.request, mocks.account.id, { name: ' New ' } as never);

    expect(mocks.accountService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.account.id,
      { name: 'New' },
      '2026-10-15',
    );
  });

  it.each([
    ['an empty body', {}],
    ['owner', { owner: 'FAMILY' }],
    ['ownerId', { ownerId }],
    ['the removed balance field', { balance: 1 }],
    ['initialBalance', { initialBalance: 1 }],
    ['null on a required field', { name: null }],
  ])(
    'SHOULD throw ValidationError (400) AND change nothing WHEN the body has %s',
    async (_label, body) => {
      await expect(setup.update(mocks.request, mocks.account.id, body as never)).rejects.toThrow(
        ValidationError,
      );
      expect(mocks.accountService.update).not.toHaveBeenCalled();
    },
  );
});

describe('delete', () => {
  it('SHOULD delete by id for the JWT user AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.account.id);

    expect(mocks.accountService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.account.id,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AccountController.prototype.delete)).toBe(204);
  });
});
