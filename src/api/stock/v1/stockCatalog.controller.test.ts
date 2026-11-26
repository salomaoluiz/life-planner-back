import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './stock.controller.mocks';
import {
  languageOf,
  StockCategoryController,
  StockLocationController,
} from './stockCatalog.controller';

const { id, ownerId, request, stockService, userId } = mocks;
let controllers: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  controllers = await setup();
});

it('SHOULD be served at /stock/categories and /stock/locations under version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, StockCategoryController)).toBe('stock/categories');
  expect(Reflect.getMetadata(PATH_METADATA, StockLocationController)).toBe('stock/locations');
  expect(Reflect.getMetadata(VERSION_METADATA, StockCategoryController)).toBe('1');
});

describe('languageOf', () => {
  it.each([
    ['pt-BR,pt;q=0.9', 'pt-BR'],
    ['PT', 'pt-BR'],
    ['en-US', 'en-US'],
    [undefined, 'en-US'],
  ])('SHOULD map %s to %s', (header, expected) => {
    expect(languageOf(header)).toBe(expected);
  });
});

describe('categories', () => {
  const query = { includeArchived: 'true', owner: 'USER', ownerId };

  it('SHOULD list with includeArchived as a boolean AND refuse a missing owner (400)', async () => {
    await controllers.categories.findAll(request, query);

    expect(stockService.findCategories).toHaveBeenCalledWith(userId, {
      includeArchived: true,
      owner: 'USER',
      ownerId,
    });
    await controllers.categories.findAll(request, { owner: 'USER', ownerId });
    expect(stockService.findCategories).toHaveBeenLastCalledWith(userId, {
      includeArchived: false,
      owner: 'USER',
      ownerId,
    });
    await controllers.categories.findAll(request, {});
    expect(stockService.findCategories).toHaveBeenLastCalledWith(userId, {
      includeArchived: false,
    });
    await expect(controllers.categories.findAll(request, { owner: 'USER' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD create, update (partial) and delete', async () => {
    const body = { color: '#F59E0B', icon: 'cart', name: 'Dairy', owner: 'USER', ownerId };

    await controllers.categories.create(request, body as never);
    await controllers.categories.update(request, id, { status: 'ARCHIVED' } as never);
    await controllers.categories.delete(request, id, {});
    await controllers.categories.delete(request, id, { moveTo: 'none' });

    expect(stockService.createCategory).toHaveBeenCalledWith(userId, body);
    expect(stockService.updateCategory).toHaveBeenCalledWith(userId, id, { status: 'ARCHIVED' });
    expect(stockService.deleteCategory).toHaveBeenCalledWith(userId, id, undefined);
    expect(stockService.deleteCategory).toHaveBeenLastCalledWith(userId, id, 'none');
    await expect(controllers.categories.delete(request, id, { moveTo: 'x' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      controllers.categories.create(request, { ...body, color: 'red' } as never),
    ).rejects.toThrow(ValidationError);
    await expect(controllers.categories.update(request, id, {} as never)).rejects.toThrow(
      ValidationError,
    );
    await expect(
      controllers.categories.create(request, { ...body, name: '' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('SHOULD create the suggestions in the language of the request', async () => {
    await controllers.categories.createSuggestions(request, { owner: 'USER', ownerId }, 'pt-BR');

    expect(stockService.createCategorySuggestions).toHaveBeenCalledWith(
      userId,
      { owner: 'USER', ownerId },
      'pt-BR',
    );
  });
});

describe('locations', () => {
  it('SHOULD list, create, update, delete and create suggestions', async () => {
    await controllers.locations.findAll(request, { owner: 'FAMILY', ownerId });
    const body = { color: '#F59E0B', icon: 'archive', name: 'Pantry', owner: 'USER', ownerId };

    await controllers.locations.create(request, body as never);
    await controllers.locations.update(request, id, { name: 'Garage' } as never);
    await controllers.locations.delete(request, id, { moveTo: id });
    await controllers.locations.createSuggestions(request, { owner: 'USER', ownerId });

    expect(stockService.findLocations).toHaveBeenCalledWith(userId, {
      includeArchived: false,
      owner: 'FAMILY',
      ownerId,
    });
    expect(stockService.createLocation).toHaveBeenCalledWith(userId, body);
    expect(stockService.updateLocation).toHaveBeenCalledWith(userId, id, { name: 'Garage' });
    expect(stockService.deleteLocation).toHaveBeenCalledWith(userId, id, id);
    expect(stockService.createLocationSuggestions).toHaveBeenCalledWith(
      userId,
      { owner: 'USER', ownerId },
      'en-US',
    );
    await expect(
      controllers.locations.update(request, id, { status: 'NOPE' } as never),
    ).rejects.toThrow(ValidationError);
  });
});
