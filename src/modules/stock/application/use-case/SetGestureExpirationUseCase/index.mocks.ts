import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { GestureContext, GesturePlanner } from '@stock/domain/repository';

import { SetGestureExpirationUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
const captured: { plan?: ReturnType<GesturePlanner> } = {};
let setup: SetGestureExpirationUseCase;

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
  setup = await build(SetGestureExpirationUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { captured, mocks, run, setup };
