import { NotFoundException } from '@nestjs/common';

import {
  accessibleOwners,
  build,
  item,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetConsumptionWeeksUseCase } from './index';

const stock = stockRepositoryMock();
let setup: GetConsumptionWeeksUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetConsumptionWeeksUseCase, [
    { provide: 'IStockRepository', useValue: stock },
  ]);
});

it('SHOULD return 12 weeks for a readable item', async () => {
  const found = item();

  stock.findById.mockResolvedValue(found);
  stock.findMovementDays.mockResolvedValue([{ ageDays: 3, consumed: 2, delta: -2 }]);

  const weeks = await setup.execute({
    accessibleOwners: accessibleOwners,
    id: found.id,
    today: '2026-11-25',
  });

  expect(weeks).toHaveLength(12);
  expect(stock.findMovementDays).toHaveBeenCalledTimes(1);
});

it('SHOULD answer 404 for an item the caller cannot read', async () => {
  stock.findById.mockResolvedValue(item());

  await expect(setup.execute({ accessibleOwners: [], id: 'x' })).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
