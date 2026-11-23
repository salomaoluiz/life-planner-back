import { Test } from '@nestjs/testing';

import { PurchaseService } from '@api/stock/v1/purchase.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CreateSplitUseCase } from '@finance/application/use-case/CreateSplitUseCase';
import { CreateTransactionUseCase } from '@finance/application/use-case/CreateTransactionUseCase';
import { DeleteSplitUseCase } from '@finance/application/use-case/DeleteSplitUseCase';
import { DeleteTransactionUseCase } from '@finance/application/use-case/DeleteTransactionUseCase';
import { market, purchase, purchaseRow } from '@stock/application/mocks/stock.mocks';
import { ChangePurchaseStatusUseCase } from '@stock/application/use-case/ChangePurchaseStatusUseCase';
import { ClosePurchaseUseCase } from '@stock/application/use-case/ClosePurchaseUseCase';
import { ClosingLockUseCase } from '@stock/application/use-case/ClosingLockUseCase';
import { CreateMarketUseCase } from '@stock/application/use-case/CreateMarketUseCase';
import { DeleteClosedPurchaseUseCase } from '@stock/application/use-case/DeleteClosedPurchaseUseCase';
import { DeletePurchaseRowUseCase } from '@stock/application/use-case/DeletePurchaseRowUseCase';
import { GetClosePreviewUseCase } from '@stock/application/use-case/GetClosePreviewUseCase';
import { GetItemPricesUseCase } from '@stock/application/use-case/GetItemPricesUseCase';
import { GetListPurchasesUseCase } from '@stock/application/use-case/GetListPurchasesUseCase';
import { GetMarketsUseCase } from '@stock/application/use-case/GetMarketsUseCase';
import { GetPendingPurchasesUseCase } from '@stock/application/use-case/GetPendingPurchasesUseCase';
import { GetPurchaseEventsUseCase } from '@stock/application/use-case/GetPurchaseEventsUseCase';
import { GetPurchaseUseCase } from '@stock/application/use-case/GetPurchaseUseCase';
import { MergePurchaseUseCase } from '@stock/application/use-case/MergePurchaseUseCase';
import { StartPurchaseUseCase } from '@stock/application/use-case/StartPurchaseUseCase';
import { UpdateClosedPurchaseUseCase } from '@stock/application/use-case/UpdateClosedPurchaseUseCase';
import { UpdateMarketUseCase } from '@stock/application/use-case/UpdateMarketUseCase';
import { UpsertPurchaseRowUseCase } from '@stock/application/use-case/UpsertPurchaseRowUseCase';

const userId = 'user-id';
const familyId = 'family-id';
const uses = {
  changeStatus: ChangePurchaseStatusUseCase,
  close: ClosePurchaseUseCase,
  closePreview: GetClosePreviewUseCase,
  closingLock: ClosingLockUseCase,
  createMarket: CreateMarketUseCase,
  createSplit: CreateSplitUseCase,
  createTransaction: CreateTransactionUseCase,
  deleteClosed: DeleteClosedPurchaseUseCase,
  deleteRow: DeletePurchaseRowUseCase,
  deleteSplit: DeleteSplitUseCase,
  deleteTransaction: DeleteTransactionUseCase,
  events: GetPurchaseEventsUseCase,
  family: GetUserFamilyAccessUseCase,
  getMarkets: GetMarketsUseCase,
  getPurchase: GetPurchaseUseCase,
  listPurchases: GetListPurchasesUseCase,
  merge: MergePurchaseUseCase,
  pending: GetPendingPurchasesUseCase,
  prices: GetItemPricesUseCase,
  start: StartPurchaseUseCase,
  updateClosed: UpdateClosedPurchaseUseCase,
  updateMarket: UpdateMarketUseCase,
  upsertRow: UpsertPurchaseRowUseCase,
};
const useCases = Object.fromEntries(
  Object.keys(uses).map((name) => [name, { execute: jest.fn() }]),
) as Record<keyof typeof uses, { execute: jest.Mock }>;
const owners = [
  { owner: 'USER', ownerId: userId },
  { archived: false, owner: 'FAMILY', ownerId: familyId },
];
const view = {
  cart: { count: 1, totalCents: 500, unpricedCount: 0 },
  forecastCents: 500,
  otherCarts: [],
  purchase: purchase('p1'),
  remaining: { count: 0, estimatedCents: 0, pricedCount: 0 },
  rows: [
    {
      ...purchaseRow('r1', { quantity: 2 }),
      description: 'Candle',
      priceChangeNotice: 'NONE',
      priceChangePercent: null,
    },
  ],
};
let setup: PurchaseService;

beforeEach(async () => {
  jest.clearAllMocks();
  useCases.family.execute.mockResolvedValue([{ archived: false, familyId, name: 'Casa' }]);

  const module = await Test.createTestingModule({
    providers: [
      PurchaseService,
      ...Object.entries(uses).map(([name, token]) => ({
        provide: token,
        useValue: useCases[name as keyof typeof uses],
      })),
    ],
  }).compile();

  setup = module.get(PurchaseService);
});

export { familyId, market, owners, purchase, purchaseRow, setup, useCases, userId, view };
