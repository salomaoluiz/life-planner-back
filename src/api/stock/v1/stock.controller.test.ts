import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { StockAPIModule } from '@api/stock/stock.module';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { StockController, StockSuggestionController } from './stock.controller';
import { mocks, setup } from './stock.controller.mocks';

const { id, ownerId, request, stockService, userId } = mocks;
let items: Awaited<ReturnType<typeof setup>>['items'];
let suggestions: Awaited<ReturnType<typeof setup>>['suggestions'];

beforeEach(async () => {
  ({ items, suggestions } = await setup());
});

it('SHOULD be served at /stock/items under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, StockController)).toBe('stock/items');
  expect(Reflect.getMetadata(VERSION_METADATA, StockController)).toBe('1');
});

describe('findAll', () => {
  it('SHOULD list WITHOUT filters', async () => {
    expect(await items.findAll(request, {})).toBe(mocks.result);
    expect(stockService.findAll).toHaveBeenCalledWith(userId, {});
  });

  it('SHOULD pass owner, category and location filters, turning one id into a list', async () => {
    await items.findAll(request, {
      categoryId: id,
      locationId: [id, ownerId],
      ownerId,
      today: '2026-11-10',
    });

    expect(stockService.findAll).toHaveBeenCalledWith(userId, {
      categoryId: [id],
      locationId: [id, ownerId],
      ownerId,
      today: '2026-11-10',
    });
  });

  it.each([
    ['a non-uuid ownerId', { ownerId: 'abc' }],
    ['a bad category id', { categoryId: 'abc' }],
    ['a bad today', { today: '10/11/2026' }],
  ])('SHOULD throw ValidationError (400) WHEN there is %s', async (_label, query) => {
    await expect(items.findAll(request, query)).rejects.toThrow(ValidationError);
  });
});

describe('suggest', () => {
  it('SHOULD pass q and the owner', async () => {
    await suggestions.suggest(request, { owner: 'USER', ownerId, q: 'musarela' });

    expect(stockService.suggest).toHaveBeenCalledWith(userId, {
      owner: 'USER',
      ownerId,
      q: 'musarela',
    });
  });

  it('SHOULD refuse a q shorter than 2 characters (400)', async () => {
    await expect(suggestions.suggest(request, { owner: 'USER', ownerId, q: 'm' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD be its own controller, registered before StockController, so :id never swallows it', () => {
    const controllers = Reflect.getMetadata('controllers', StockAPIModule) as unknown[];

    expect(Reflect.getMetadata(PATH_METADATA, StockSuggestionController)).toBe(
      'stock/items/suggestions',
    );
    expect(controllers.indexOf(StockSuggestionController)).toBeLessThan(
      controllers.indexOf(StockController),
    );
  });
});

describe('findById / delete / findMovements / ownerChangePreview', () => {
  it('SHOULD read the item with the optional day', async () => {
    await items.findById(request, id, { today: '2026-11-10' });

    expect(stockService.findById).toHaveBeenCalledWith(userId, id, '2026-11-10');
  });

  it('SHOULD delete with 204', async () => {
    await items.delete(request, id);

    expect(stockService.delete).toHaveBeenCalledWith(userId, id);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StockController.prototype.delete)).toBe(204);
  });

  it('SHOULD page the movements with the cursor', async () => {
    await items.findMovements(request, id, { cursor: 'abc' });

    expect(stockService.findMovements).toHaveBeenCalledWith(userId, id, 'abc');
  });

  it('SHOULD preview an owner change AND require both owner and ownerId', async () => {
    await items.ownerChangePreview(request, id, { owner: 'FAMILY', ownerId });

    expect(stockService.ownerChangePreview).toHaveBeenCalledWith(userId, id, 'FAMILY', ownerId);
    await expect(items.ownerChangePreview(request, id, { owner: 'FAMILY' })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('create / update', () => {
  const body = {
    description: 'Rice',
    owner: 'USER',
    ownerId,
    quantity: 1.5,
    unit: 'kilogram',
  } as never;

  it('SHOULD create validating the strict body (kg decimals accepted)', async () => {
    await items.create(request, body);

    expect(stockService.create).toHaveBeenCalledWith(userId, body);
  });

  it.each([
    ['an unknown field', { ...(body as object), extra: 1 }],
    ['a removed unit', { ...(body as object), unit: 'gram' }],
    ['a negative quantity', { ...(body as object), quantity: -1 }],
    ['a bad day', { ...(body as object), expirationDate: '2026-13-45' }],
  ])('SHOULD refuse %s on create (400)', async (_label, bad) => {
    await expect(items.create(request, bad as never)).rejects.toThrow(ValidationError);
  });

  it('SHOULD update item fields only: quantity is not editable (400)', async () => {
    await items.update(request, id, { minQuantity: 2, stockOnly: false } as never);
    expect(stockService.update).toHaveBeenCalledWith(userId, id, {
      minQuantity: 2,
      stockOnly: false,
    });

    await expect(items.update(request, id, { quantity: 3 } as never)).rejects.toThrow(
      ValidationError,
    );
    await expect(items.update(request, id, {} as never)).rejects.toThrow(ValidationError);
    await expect(items.update(request, id, { owner: 'FAMILY' } as never)).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('createMovement', () => {
  it.each([
    [{ expirationDate: '2026-12-01', quantity: 1, type: 'ENTRY' }],
    [{ quantity: 1, type: 'CONSUME' }],
    [{ type: 'OPEN' }],
    [{ lotId: id, reason: 'EXPIRED', type: 'DISCARD' }],
    [{ countedQuantity: 2, type: 'ADJUST' }],
  ])('SHOULD accept %j', async (body) => {
    await items.createMovement(request, id, body as never);

    expect(stockService.createMovement).toHaveBeenCalledWith(userId, id, body);
  });

  it.each([
    [{ quantity: 1, type: 'INITIAL' }],
    [{ type: 'CONSUME' }],
    [{ lotId: id, type: 'DISCARD' }],
    [{ countedQuantity: -1, type: 'ADJUST' }],
    [{ extra: true, quantity: 1, type: 'CONSUME' }],
  ])('SHOULD refuse %j (400)', async (body) => {
    await expect(items.createMovement(request, id, body as never)).rejects.toThrow(ValidationError);
  });
});
