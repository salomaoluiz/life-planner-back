import {
  accessibleOwners,
  archivedOwners,
  build,
  market,
  marketRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { CreateMarketUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, markets: marketRepositoryMock() };
const base = { accessibleOwners, name: 'Bom Preço', owner: 'USER' as never, ownerId: userId };
let setup: CreateMarketUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.markets.create.mockResolvedValue(market('m'));
  setup = await build(CreateMarketUseCase, [
    { provide: 'IMarketRepository', useValue: mocks.markets },
  ]);
});

export { base, mocks, setup };
