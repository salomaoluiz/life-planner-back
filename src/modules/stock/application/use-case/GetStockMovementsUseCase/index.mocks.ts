import {
  accessibleOwners,
  build,
  item,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import StockMovementEntity, { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';

import { GetStockMovementsUseCase } from './index';

const mocks = { accessibleOwners, stock: stockRepositoryMock() };
let setup: GetStockMovementsUseCase;

function movement(id: string, createdAt = '2026-11-10T12:00:00.000Z') {
  return new StockMovementEntity({
    createdAt: new Date(createdAt),
    id,
    itemId: 'item',
    lotId: 'lot',
    quantity: 1,
    type: StockMovementTypes.ENTRY,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(item([]));
  mocks.stock.findMovements.mockResolvedValue([]);
  setup = await build(GetStockMovementsUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
  ]);
});

export { mocks, movement, setup };
