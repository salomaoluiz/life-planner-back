import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { StockController } from './stock.controller';
import { mocks, setup } from './stock.controller.mocks';

const ownerId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const validBody = { description: 'Rice', owner: 'USER', ownerId, quantity: 2, unit: 'kilogram' };

it('SHOULD be served at /stock/items under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, StockController)).toBe('stock/items');
  expect(Reflect.getMetadata(VERSION_METADATA, StockController)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD list WITHOUT a filter', async () => {
    expect(await setup.findAll(mocks.request, {})).toEqual([mocks.item]);
    expect(mocks.stockService.findAll).toHaveBeenCalledWith(mocks.request.user.id, undefined);
  });

  it('SHOULD pass a single ownerId to the service', async () => {
    await setup.findAll(mocks.request, { ownerId });

    expect(mocks.stockService.findAll).toHaveBeenCalledWith(mocks.request.user.id, ownerId);
  });

  it.each([
    ['a non-uuid ownerId', 'abc'],
    ['a repeated ownerId', [ownerId, ownerId]],
  ])('SHOULD throw ValidationError (400) WHEN there is %s', async (_label, value) => {
    await expect(setup.findAll(mocks.request, { ownerId: value })).rejects.toThrow(ValidationError);
    expect(mocks.stockService.findAll).not.toHaveBeenCalled();
  });
});

describe('findById', () => {
  it('SHOULD return the item for the JWT user', async () => {
    expect(await setup.findById(mocks.request, mocks.item.id)).toEqual(mocks.item);
    expect(mocks.stockService.findById).toHaveBeenCalledWith(mocks.request.user.id, mocks.item.id);
  });
});

describe('create', () => {
  it('SHOULD validate the body AND call the service with the JWT user', async () => {
    const result = await setup.create(mocks.request, validBody as never);

    expect(mocks.stockService.create).toHaveBeenCalledWith(mocks.request.user.id, validBody);
    expect(result).toEqual(mocks.item);
  });

  it.each([
    ['a missing body', undefined],
    ['an unknown field', { ...validBody, id: ownerId }],
    ['a fractional quantity', { ...validBody, quantity: 1.5 }],
    ['a missing owner', { ...validBody, owner: undefined }],
  ])('SHOULD throw ValidationError (400) WHEN the body has %s', async (_label, body) => {
    await expect(setup.create(mocks.request, body as never)).rejects.toThrow(ValidationError);
    expect(mocks.stockService.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('SHOULD validate the patch AND call the service', async () => {
    await setup.update(mocks.request, mocks.item.id, { notes: null } as never);

    expect(mocks.stockService.update).toHaveBeenCalledWith(mocks.request.user.id, mocks.item.id, {
      notes: null,
    });
  });

  it.each([
    ['an empty body', {}],
    ['only owner', { owner: 'FAMILY' }],
    ['only ownerId', { ownerId }],
    ['null on a required field', { description: null }],
  ])(
    'SHOULD throw ValidationError (400) AND change nothing WHEN the body has %s',
    async (_label, body) => {
      await expect(setup.update(mocks.request, mocks.item.id, body as never)).rejects.toThrow(
        ValidationError,
      );
      expect(mocks.stockService.update).not.toHaveBeenCalled();
    },
  );
});

describe('delete', () => {
  it('SHOULD delete by id for the JWT user AND answer 204', async () => {
    await setup.delete(mocks.request, mocks.item.id);

    expect(mocks.stockService.delete).toHaveBeenCalledWith(mocks.request.user.id, mocks.item.id);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StockController.prototype.delete)).toBe(204);
  });
});
