import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { TagController } from './tag.controller';
import { mocks, setup } from './tag.controller.mocks';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';

it('SHOULD be served at /finance/tags under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, TagController)).toBe('finance/tags');
  expect(Reflect.getMetadata(VERSION_METADATA, TagController)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD pass no filters by default', async () => {
    await setup.findAll(mocks.request, {});

    expect(mocks.tagService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      undefined,
    );
  });

  it('SHOULD pass the ownerId list AND the text filter', async () => {
    await setup.findAll(mocks.request, { ownerId, q: 'gas' });

    expect(mocks.tagService.findAll).toHaveBeenCalledWith(mocks.request.user.id, [ownerId], 'gas');
  });

  it('SHOULD throw ValidationError WHEN the ownerId is not a uuid', async () => {
    await expect(setup.findAll(mocks.request, { ownerId: 'abc' })).rejects.toThrow(ValidationError);
  });
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, {
      name: 'gasto-fixo',
      owner: 'USER',
      ownerId,
    } as never);

    expect(mocks.tagService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      name: 'gasto-fixo',
      owner: 'USER',
      ownerId,
    });
    expect(result).toBe(mocks.tag);
  });

  it.each([
    ['an empty name', { name: ' ', owner: 'USER', ownerId }],
    ['a 31-character name', { name: 'x'.repeat(31), owner: 'USER', ownerId }],
    ['ALL with an ownerId', { name: 'a', owner: 'ALL', ownerId }],
    ['a single scope without ownerId', { name: 'a', owner: 'FAMILY' }],
  ])('SHOULD throw ValidationError WHEN the body has %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.tagService.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('SHOULD validate the patch AND forward the id', async () => {
    await setup.update(mocks.request, ownerId, { name: 'novo' } as never);

    expect(mocks.tagService.update).toHaveBeenCalledWith(mocks.request.user.id, ownerId, {
      name: 'novo',
    });
  });

  it.each([{}, { owner: 'USER' }, { scope: 'PERSONAL' }])(
    'SHOULD throw ValidationError WHEN the patch is %j',
    async (body) => {
      await expect(setup.update(mocks.request, ownerId, body as never)).rejects.toThrow(
        ValidationError,
      );
    },
  );
});

describe('delete', () => {
  it('SHOULD delete through the service', async () => {
    await setup.delete(mocks.request, ownerId);

    expect(mocks.tagService.delete).toHaveBeenCalledWith(mocks.request.user.id, ownerId);
  });
});
