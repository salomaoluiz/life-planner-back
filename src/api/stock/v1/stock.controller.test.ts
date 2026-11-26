import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { StockAPIModule } from '@api/stock/stock.module';
import { ValidationError } from '@shared/domain/error/ValidationError';

import {
  StockController,
  StockLotController,
  StockSuggestionController,
  StockWasteController,
} from './stock.controller';
import { mocks, setup } from './stock.controller.mocks';

const { id, ownerId, request, stockService, userId } = mocks;
let items: Awaited<ReturnType<typeof setup>>['items'];
let lots: Awaited<ReturnType<typeof setup>>['lots'];
let suggestions: Awaited<ReturnType<typeof setup>>['suggestions'];
let waste: Awaited<ReturnType<typeof setup>>['waste'];

beforeEach(async () => {
  ({ items, lots, suggestions, waste } = await setup());
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

    expect(stockService.createMovement).toHaveBeenCalledWith(userId, id, body, undefined);
  });

  it('SHOULD pass the gesture fields and the Idempotency-Key to the service', async () => {
    const key = '3f0e0000-0000-4000-8000-000000000002';
    const body = {
      expiredLots: 'DISCARD_THEN_VALID',
      gestureId: '9b1c0000-0000-4000-8000-000000000001',
      quantity: 3,
      type: 'CONSUME',
    };

    await items.createMovement(request, id, body as never, key);

    expect(stockService.createMovement).toHaveBeenCalledWith(userId, id, body, key);
  });

  it('SHOULD refuse a key that is not a uuid (400)', async () => {
    await expect(
      items.createMovement(request, id, { quantity: 1, type: 'CONSUME' } as never, 'nope'),
    ).rejects.toThrow(ValidationError);
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

describe('spec 117 routes', () => {
  it('SHOULD list frequent items with a validated limit', async () => {
    const { frequent } = await setup();

    await frequent.frequent(request, { limit: '5' });
    expect(stockService.findFrequent).toHaveBeenCalledWith(userId, { limit: 5 });
    await expect(frequent.frequent(request, { limit: '11' })).rejects.toThrow(ValidationError);
  });

  it('SHOULD undo a gesture and change its expiration for the requester', async () => {
    const { gestures } = await setup();
    const gestureId = '9b1c0000-0000-4000-8000-000000000001';

    await gestures.undo(request, { gestureId } as never);
    expect(stockService.undoGesture).toHaveBeenCalledWith(userId, gestureId);

    await gestures.expiration(request, gestureId, { expirationDate: '2026-12-05' } as never);
    expect(stockService.setGestureExpiration).toHaveBeenCalledWith(userId, gestureId, {
      expirationDate: '2026-12-05',
    });
    await expect(gestures.undo(request, { gestureId: 'nope' } as never)).rejects.toThrow(
      ValidationError,
    );
    await expect(
      gestures.expiration(request, gestureId, { expirationDate: 'x' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('SHOULD accept suggestions without an owner', async () => {
    await suggestions.suggest(request, { q: 'leite' });

    expect(stockService.suggest).toHaveBeenCalledWith(userId, { q: 'leite' });
  });
});

describe('spec 123', () => {
  it('SHOULD read the consumption weeks of an item with an optional day', async () => {
    await items.findConsumptionWeeks(request, id, { today: '2026-11-25' });

    expect(stockService.findConsumptionWeeks).toHaveBeenCalledWith(userId, id, '2026-11-25');
  });

  it('SHOULD dismiss the leftover warning of a lot (204) AND undo it', async () => {
    await lots.dismiss(request, id);
    await lots.undoDismissal(request, id);

    expect(stockService.dismissLeftover).toHaveBeenNthCalledWith(1, userId, id, true);
    expect(stockService.dismissLeftover).toHaveBeenNthCalledWith(2, userId, id, false);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, StockLotController.prototype.dismiss)).toBe(204);
    expect(Reflect.getMetadata(PATH_METADATA, StockLotController)).toBe('stock/lots');
  });
});

describe('waste (spec 123)', () => {
  it('SHOULD be served at /stock/waste AND pass month, owner and topLimit', async () => {
    await waste.find(request, { month: '2026-11', ownerId, topLimit: 'all' });

    expect(Reflect.getMetadata(PATH_METADATA, StockWasteController)).toBe('stock/waste');
    expect(stockService.findWaste).toHaveBeenCalledWith(userId, {
      month: '2026-11',
      ownerId,
      topLimit: 'all',
    });
  });

  it('SHOULD refuse a bad month', async () => {
    await expect(waste.find(request, { month: '2026-13' })).rejects.toBeInstanceOf(ValidationError);
  });
});
