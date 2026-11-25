import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { build, stockRepositoryMock } from '@stock/application/mocks/stock.mocks';
import { StockForecastGate } from '@stock/application/service/StockForecastGate';

import { RefreshStaleForecastsUseCase } from './index';

const today = new Date('2026-11-25T00:00:00.000Z');
const owners = [{ owner: OwnerType.USER, ownerId: 'u' }];
const stock = stockRepositoryMock();
const gate = {
  runOnce: jest.fn(async (_keys: string[], _day: string, task: () => Promise<void>) => task()),
};
let setup: RefreshStaleForecastsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  stock.findStaleForecastItemIds.mockResolvedValue(['a', 'b']);
  setup = await build(RefreshStaleForecastsUseCase, [
    { provide: 'IStockRepository', useValue: stock },
    { provide: StockForecastGate, useValue: gate },
  ]);
});

it('SHOULD refresh the stale items of the owners in one call, through the gate', async () => {
  await setup.execute({ owners, today });

  expect(gate.runOnce).toHaveBeenCalledWith(['USER:u'], '2026-11-25', expect.any(Function));
  expect(stock.findStaleForecastItemIds).toHaveBeenCalledWith(owners, today);
  expect(stock.refreshForecasts).toHaveBeenCalledTimes(1);
  expect(stock.refreshForecasts).toHaveBeenCalledWith(['a', 'b'], today);
});

it('SHOULD skip archived owners without touching the gate', async () => {
  await setup.execute({ owners: [{ ...owners[0], archived: true }], today });

  expect(gate.runOnce).not.toHaveBeenCalled();
});
