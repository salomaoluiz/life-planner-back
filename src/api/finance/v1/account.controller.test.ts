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
  it('SHOULD list the accounts of the JWT user without an ownerId filter', async () => {
    const result = await setup.findAll(mocks.request, {});

    expect(mocks.accountService.findAll).toHaveBeenCalledWith(mocks.request.user.id, undefined);
    expect(result).toEqual([mocks.account]);
  });

  it.each([
    ['a single ownerId', ownerId, [ownerId]],
    ['repeated ownerIds', [ownerId, ownerId], [ownerId, ownerId]],
  ])('SHOULD pass %s to the service as an array', async (_label, query, expected) => {
    await setup.findAll(mocks.request, { ownerId: query });

    expect(mocks.accountService.findAll).toHaveBeenCalledWith(mocks.request.user.id, expected);
  });

  it('SHOULD throw ValidationError WHEN an ownerId is not a uuid', async () => {
    await expect(setup.findAll(mocks.request, { ownerId: 'abc' })).rejects.toThrow(ValidationError);
    expect(mocks.accountService.findAll).not.toHaveBeenCalled();
  });
});

describe('create', () => {
  it('SHOULD validate the body (defaults applied) AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, validBody as never);

    expect(mocks.accountService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      ...validBody,
      balance: 0,
      status: 'ACTIVE',
    });
    expect(result).toEqual(mocks.account);
  });

  it.each([
    ['a missing body', undefined],
    ['a fractional balance', { ...validBody, balance: 12.5 }],
    ['a missing owner', { icon: 'bank', name: 'x', ownerId }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.accountService.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('SHOULD validate the patch AND call the service', async () => {
    await setup.update(mocks.request, mocks.account.id, { name: ' New ' } as never);

    expect(mocks.accountService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.account.id,
      { name: 'New' },
    );
  });

  it.each([
    ['an empty body', {}],
    ['owner', { owner: 'FAMILY' }],
    ['ownerId', { ownerId }],
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
