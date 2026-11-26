import { Test } from '@nestjs/testing';

import {
  StockController,
  StockFrequentController,
  StockGestureController,
  StockLotController,
  StockSuggestionController,
  StockWasteController,
} from '@api/stock/v1/stock.controller';
import { StockService } from '@api/stock/v1/stock.service';
import {
  StockCategoryController,
  StockLocationController,
} from '@api/stock/v1/stockCatalog.controller';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = '5b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const ownerId = '1b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const request = { user: { id: userId } } as JwtPayload & Request;
const result = { ok: true };

const methods = [
  'create',
  'createCategory',
  'createCategorySuggestions',
  'createLocation',
  'createLocationSuggestions',
  'createMovement',
  'delete',
  'deleteCategory',
  'deleteLocation',
  'dismissLeftover',
  'findAll',
  'findConsumptionWeeks',
  'findById',
  'findFrequent',
  'findLocationById',
  'findCategories',
  'findLocations',
  'findWaste',
  'findMovements',
  'ownerChangePreview',
  'setGestureExpiration',
  'suggest',
  'undoGesture',
  'update',
  'updateCategory',
  'updateLocation',
] as const;
const stockService = Object.fromEntries(
  methods.map((method) => [method, jest.fn().mockResolvedValue(result)]),
) as Record<(typeof methods)[number], jest.Mock>;

async function setup() {
  jest.clearAllMocks();
  methods.forEach((method) => stockService[method].mockResolvedValue(result));

  const module = await Test.createTestingModule({
    controllers: [
      StockController,
      StockSuggestionController,
      StockFrequentController,
      StockGestureController,
      StockLotController,
      StockWasteController,
      StockCategoryController,
      StockLocationController,
    ],
    providers: [{ provide: StockService, useValue: stockService }],
  }).compile();

  return {
    categories: module.get(StockCategoryController),
    frequent: module.get(StockFrequentController),
    gestures: module.get(StockGestureController),
    items: module.get(StockController),
    locations: module.get(StockLocationController),
    lots: module.get(StockLotController),
    suggestions: module.get(StockSuggestionController),
    waste: module.get(StockWasteController),
  };
}

const mocks = { id, ownerId, request, result, stockService, userId };

export { mocks, setup };
