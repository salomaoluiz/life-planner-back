import { HTTP_CODE_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './family.controller.mocks';

it('SHOULD be served under URI version 1', () => {
  expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD list the families of the JWT user', async () => {
    const result = await setup.findAll(mocks.request);

    expect(mocks.familyService.findAll).toHaveBeenCalledWith(mocks.request.user.id);
    expect(result).toEqual([mocks.family]);
  });
});

describe('create', () => {
  it('SHOULD create the family for the JWT user with the trimmed name', async () => {
    const result = await setup.create(mocks.request, { name: '  Example Family ' });

    expect(mocks.familyService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      name: 'Example Family',
    });
    expect(result).toEqual(mocks.family);
  });

  it('SHOULD drop client-supplied ownerId/userId so they never reach the service', async () => {
    const body = { name: 'Example Family', ownerId: 'someone-else', userId: 'someone-else' };

    await setup.create(mocks.request, body);

    expect(mocks.familyService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      name: 'Example Family',
    });
  });

  it.each([
    ['missing body', undefined],
    ['missing name', {}],
    ['empty name', { name: '' }],
    ['whitespace-only name', { name: '   ' }],
    ['51-character name', { name: 'a'.repeat(51) }],
    ['null name', { name: null }],
    ['numeric name', { name: 123 }],
  ])('SHOULD throw ValidationError (400) WHEN %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.familyService.create).not.toHaveBeenCalled();
  });
});

describe('findById', () => {
  it('SHOULD return the family for the JWT user', async () => {
    const result = await setup.findById(mocks.request, mocks.family.id);

    expect(mocks.familyService.findById).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.family.id,
    );
    expect(result).toEqual(mocks.family);
  });
});

describe('update', () => {
  it('SHOULD rename the family (only the name) for the JWT user', async () => {
    const result = await setup.update(mocks.request, mocks.family.id, {
      name: 'Renamed',
      ownerId: 'someone-else',
    } as { name: string });

    expect(mocks.familyService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.family.id,
      { name: 'Renamed' },
    );
    expect(result).toEqual(mocks.family);
  });

  it('SHOULD throw ValidationError (400) WHEN the name is blank', async () => {
    await expect(setup.update(mocks.request, mocks.family.id, { name: ' ' })).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.familyService.update).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('SHOULD delete the family for the JWT user AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.family.id);

    expect(mocks.familyService.delete).toHaveBeenCalledWith(mocks.request.user.id, mocks.family.id);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, setup.delete)).toBe(204);
  });
});
