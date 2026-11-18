import { Test } from '@nestjs/testing';

import { ShoppingListController } from '@api/stock/v1/shoppingList.controller';
import { ShoppingListService } from '@api/stock/v1/shoppingList.service';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = '5b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const ownerId = '1b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const request = { user: { id: userId } } as JwtPayload & Request;
const result = { ok: true };
const methods = [
  'addRow',
  'create',
  'deleteRow',
  'findAll',
  'findById',
  'restockSummary',
  'update',
  'updateRow',
] as const;
const service = Object.fromEntries(
  methods.map((method) => [method, jest.fn().mockResolvedValue(result)]),
) as Record<(typeof methods)[number], jest.Mock>;

async function setup() {
  jest.clearAllMocks();
  methods.forEach((method) => service[method].mockResolvedValue(result));

  const module = await Test.createTestingModule({
    controllers: [ShoppingListController],
    providers: [{ provide: ShoppingListService, useValue: service }],
  }).compile();

  return module.get(ShoppingListController);
}

const mocks = { id, ownerId, request, result, service, userId };

export { mocks, setup };
