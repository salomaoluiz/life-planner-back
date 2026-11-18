import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import StockMovementEntity, { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';
import { GestureContext, GesturePlanner } from '@stock/domain/repository';

import { UndoStockGestureUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
const gestureId = '9b1c0000-0000-4000-8000-000000000001';
const createdAt = new Date('2026-11-18T10:00:00.000Z');
const captured: { plan?: ReturnType<GesturePlanner> } = {};
let setup: UndoStockGestureUseCase;

function movement(lotId: string, quantity: number, type = StockMovementTypes.CONSUME) {
  return new StockMovementEntity({
    createdAt,
    gestureId,
    id: `m-${lotId}`,
    itemId: 'item',
    lotId,
    quantity,
    type,
  });
}

// Hands the planner the context and resolves with the item the datasource would return.
function run(context: Partial<GestureContext> & Pick<GestureContext, 'item' | 'movements'>) {
  mocks.stock.applyGestureChange.mockImplementation(
    async (_g: string, _u: string, planner: GesturePlanner) => {
      captured.plan = planner({ foreignLotIds: [], laterLotIds: [], ...context });

      return { item: context.item };
    },
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(UndoStockGestureUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { captured, createdAt, gestureId, item, lot, mocks, movement, run, setup };
