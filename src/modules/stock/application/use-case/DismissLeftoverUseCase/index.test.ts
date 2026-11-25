import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  accessibleOwners,
  build,
  item,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { DismissLeftoverUseCase } from './index';

const stock = stockRepositoryMock();
let setup: DismissLeftoverUseCase;

function withLeftover() {
  const found = item();

  found.forecast = { leftoverLotId: 'lot', leftoverQuantity: 2, status: 'OK' };

  return found;
}

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(DismissLeftoverUseCase, [{ provide: 'IStockRepository', useValue: stock }]);
});

it('SHOULD store the leftover the warning showed', async () => {
  stock.findByLotId.mockResolvedValue(withLeftover());

  await setup.execute({ accessibleOwners, dismissed: true, lotId: 'lot' });

  expect(stock.setLeftoverDismissal).toHaveBeenCalledWith('lot', 2);
});

it('SHOULD clear the dismissal on undo', async () => {
  stock.findByLotId.mockResolvedValue(withLeftover());

  await setup.execute({ accessibleOwners, dismissed: false, lotId: 'lot' });

  expect(stock.setLeftoverDismissal).toHaveBeenCalledWith('lot', null);
});

it('SHOULD refuse a lot that has no leftover warning', async () => {
  stock.findByLotId.mockResolvedValue(item());

  await expect(
    setup.execute({ accessibleOwners, dismissed: true, lotId: 'lot' }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});

it('SHOULD answer 404 for a lot the caller cannot read', async () => {
  stock.findByLotId.mockResolvedValue(withLeftover());

  await expect(
    setup.execute({ accessibleOwners: [], dismissed: true, lotId: 'lot' }),
  ).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD answer 422 for an archived family', async () => {
  const found = withLeftover();

  stock.findByLotId.mockResolvedValue(found);

  await expect(
    setup.execute({
      accessibleOwners: [{ archived: true, owner: found.owner, ownerId: found.ownerId }],
      dismissed: true,
      lotId: 'lot',
    }),
  ).rejects.toBeInstanceOf(UnprocessableEntityException);
});
