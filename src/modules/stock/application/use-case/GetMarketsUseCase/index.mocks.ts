import {
  accessibleOwners,
  archivedOwners,
  build,
  market,
  marketRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetMarketsUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, markets: marketRepositoryMock() };
let setup: GetMarketsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.markets.findByOwners.mockResolvedValue([market('m')]);
  setup = await build(GetMarketsUseCase, [
    { provide: 'IMarketRepository', useValue: mocks.markets },
  ]);
});

export { mocks, setup };
