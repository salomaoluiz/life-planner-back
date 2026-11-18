import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetOwnerChangePreviewUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
let setup: GetOwnerChangePreviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(
    item([], (f) => f.withCategoryId('c').withLocationId('l')),
  );
  setup = await build(GetOwnerChangePreviewUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
