import { Test } from '@nestjs/testing';

import { ShoppingListMapper } from '@stock/data/datasource/mapper/ShoppingListMapper';

import { ShoppingListRepository } from './index';

jest.mock('@stock/data/datasource/mapper/ShoppingListMapper');

const datasource = {
  addRow: jest.fn(),
  create: jest.fn(),
  deleteByOwner: jest.fn(),
  deleteRow: jest.fn(),
  ensureDefault: jest.fn(),
  findById: jest.fn(),
  findByOwners: jest.fn(),
  findClosedPurchaseDates: jest.fn(),
  findRestockRows: jest.fn(),
  findRowById: jest.fn(),
  findRowsByLists: jest.fn(),
  update: jest.fn(),
  updateRow: jest.fn(),
};
const spies = {
  toList: jest.mocked(ShoppingListMapper.toList),
  toRecord: jest.mocked(ShoppingListMapper.toRecord),
};
let setup: ShoppingListRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.toList.mockReturnValue({ id: 'list' } as never);
  spies.toRecord.mockReturnValue({ id: 'record' } as never);

  const module = await Test.createTestingModule({
    providers: [
      ShoppingListRepository,
      { provide: 'IShoppingListDatasource', useValue: datasource },
    ],
  }).compile();

  setup = module.get(ShoppingListRepository);
});

export { datasource, setup, spies };
