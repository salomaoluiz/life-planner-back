import { Test } from '@nestjs/testing';

import {
  ItemPriceController,
  ListPurchaseController,
  MarketController,
  PendingPurchaseController,
  PurchaseController,
  PurchaseEventsController,
} from '@api/stock/v1/purchase.controller';
import { PurchaseService } from '@api/stock/v1/purchase.service';
import { JwtPayload } from '@shared/infra/jwt/types';

const userId = '5b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const rowId = '2b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const key = '3b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const request = { user: { id: userId } } as JwtPayload & Request;
const result = { ok: true };
const methods = [
  'changeStatus',
  'close',
  'closePreview',
  'closingLock',
  'createMarket',
  'deleteClosed',
  'events',
  'findMarkets',
  'findPurchase',
  'itemPrices',
  'listPurchases',
  'merge',
  'pending',
  'removeRow',
  'start',
  'updateClosed',
  'updateMarket',
  'addRowByCode',
  'upsertRow',
] as const;
const service = Object.fromEntries(
  methods.map((method) => [method, jest.fn().mockResolvedValue(result)]),
) as Record<(typeof methods)[number], jest.Mock>;
const notifier = { subscribe: jest.fn() };

async function setup() {
  jest.clearAllMocks();
  methods.forEach((method) => service[method].mockResolvedValue(result));
  notifier.subscribe.mockResolvedValue(jest.fn());

  const module = await Test.createTestingModule({
    controllers: [
      ItemPriceController,
      ListPurchaseController,
      MarketController,
      PendingPurchaseController,
      PurchaseController,
      PurchaseEventsController,
    ],
    providers: [
      { provide: PurchaseService, useValue: service },
      { provide: 'INotifier', useValue: notifier },
    ],
  }).compile();

  return {
    events: module.get(PurchaseEventsController),
    items: module.get(ItemPriceController),
    lists: module.get(ListPurchaseController),
    markets: module.get(MarketController),
    pending: module.get(PendingPurchaseController),
    purchases: module.get(PurchaseController),
  };
}

const mocks = { id, key, notifier, request, result, rowId, service, userId };

export { mocks, setup };
