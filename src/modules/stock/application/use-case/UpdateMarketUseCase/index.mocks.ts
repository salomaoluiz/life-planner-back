import {
  accessibleOwners,
  build,
  market,
  marketRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { UpdateMarketUseCase } from './index';

const mocks = { accessibleOwners, markets: marketRepositoryMock() };
let setup: UpdateMarketUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.markets.findById.mockResolvedValue(market('m'));
  mocks.markets.update.mockResolvedValue(market('m'));
  setup = await build(UpdateMarketUseCase, [
    { provide: 'IMarketRepository', useValue: mocks.markets },
  ]);
});

export { mocks, setup };
