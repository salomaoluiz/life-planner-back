import { Test } from '@nestjs/testing';

import { StockController, StockSuggestionController } from '@api/stock/v1/stock.controller';
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
  'findAll',
  'findById',
  'findCategories',
  'findLocations',
  'findMovements',
  'ownerChangePreview',
  'suggest',
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
      StockCategoryController,
      StockLocationController,
    ],
    providers: [{ provide: StockService, useValue: stockService }],
  }).compile();

  return {
    categories: module.get(StockCategoryController),
    items: module.get(StockController),
    locations: module.get(StockLocationController),
    suggestions: module.get(StockSuggestionController),
  };
}

const mocks = { id, ownerId, request, result, stockService, userId };

export { mocks, setup };
