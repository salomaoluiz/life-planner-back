import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { CategoryController } from './category.controller';
import { mocks, setup } from './category.controller.mocks';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const validBody = { icon: 'cart', name: 'Groceries', owner: 'USER', ownerId, type: 'EXPENSE' };

it('SHOULD be served at /finance/categories under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, CategoryController)).toBe('finance/categories');
  expect(Reflect.getMetadata(VERSION_METADATA, CategoryController)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD pass no filters by default', async () => {
    await setup.findAll(mocks.request, {});

    expect(mocks.categoryService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      undefined,
      undefined,
    );
  });

  it('SHOULD pass ownerId list and type filter', async () => {
    await setup.findAll(mocks.request, { ownerId: [ownerId], type: 'INCOME' });

    expect(mocks.categoryService.findAll).toHaveBeenCalledWith(
      mocks.request.user.id,
      [ownerId],
      'INCOME',
    );
  });

  it.each([
    ['an unknown type', { type: 'OTHER' }],
    ['a non-uuid ownerId', { ownerId: 'abc' }],
  ])('SHOULD throw ValidationError WHEN the query has %s', async (_label, query) => {
    await expect(setup.findAll(mocks.request, query)).rejects.toThrow(ValidationError);
    expect(mocks.categoryService.findAll).not.toHaveBeenCalled();
  });
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, validBody as never);

    expect(mocks.categoryService.create).toHaveBeenCalledWith(mocks.request.user.id, {
      ...validBody,
      iconColor: '#000000',
    });
    expect(result).toEqual(mocks.category);
  });

  it('SHOULD throw ValidationError (400) WHEN the body is invalid', async () => {
    await expect(
      setup.create(mocks.request, { ...validBody, iconColor: 'red' } as never),
    ).rejects.toThrow(ValidationError);
    expect(mocks.categoryService.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('SHOULD forward a valid patch', async () => {
    await setup.update(mocks.request, mocks.category.id, { parentId: null } as never);

    expect(mocks.categoryService.update).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.category.id,
      { parentId: null },
    );
  });

  it.each([
    ['an empty body', {}],
    ['owner', { owner: 'FAMILY' }],
    ['ownerId', { ownerId }],
    ['depthLevel', { depthLevel: 3 }],
  ])(
    'SHOULD throw ValidationError (400) AND change nothing WHEN the body has %s',
    async (_label, body) => {
      await expect(setup.update(mocks.request, mocks.category.id, body as never)).rejects.toThrow(
        ValidationError,
      );
      expect(mocks.categoryService.update).not.toHaveBeenCalled();
    },
  );
});

describe('delete', () => {
  it('SHOULD delete by id AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.category.id);

    expect(mocks.categoryService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.category.id,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, CategoryController.prototype.delete)).toBe(204);
  });
});
