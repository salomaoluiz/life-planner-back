import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import StockEntity from '@stock/domain/entity/StockEntity';
import { MovementPlanner } from '@stock/domain/repository';

import { CreateStockMovementUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
let setup: CreateStockMovementUseCase;

// Runs the planner the use case hands to the repository against `locked` and returns what it would write.
function plan(locked: StockEntity) {
  mocks.stock.applyMovement.mockImplementation(
    async (_id: string, _user: string, planner: MovementPlanner) => {
      const operations = planner(locked);

      return { item: locked, movements: [], operations };
    },
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(item([lot('a', 3)]));
  plan(item([lot('a', 3)]));
  setup = await build(CreateStockMovementUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

async function operationsOf(locked: StockEntity, input: Record<string, unknown>) {
  plan(locked);
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    itemId: 'item',
    today: '2026-11-10',
    userId: 'user-id',
    ...input,
  } as never);

  const planner = mocks.stock.applyMovement.mock.lastCall?.[2] as MovementPlanner;

  return planner(locked);
}

export { item, lot, mocks, operationsOf, plan, setup };
