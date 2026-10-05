import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { StockService } from '@api/stock/v1/stock.service';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { StockUnits } from '@stock/domain/entity/StockEntity';

// region Mocks

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];
const itemResultMock = {
  barcode: '7890000000001',
  brand: undefined,
  createdAt: new Date('2026-09-30T12:01:00.000Z'),
  description: 'Whole milk',
  expirationDate: new Date('2026-10-20T00:00:00.000Z'),
  id: faker.string.uuid(),
  notes: undefined,
  openingDate: undefined,
  owner: OwnerType.FAMILY,
  ownerId: familyId,
  purchaseDate: undefined,
  quantity: 6,
  unit: StockUnits.LITER,
  updatedAt: new Date('2026-09-30T13:00:00.000Z'),
};
const itemApiMock = {
  barcode: '7890000000001',
  brand: null,
  createdAt: '2026-09-30T12:01:00.000Z',
  description: 'Whole milk',
  expirationDate: '2026-10-20T00:00:00.000Z',
  id: itemResultMock.id,
  notes: null,
  openingDate: null,
  owner: 'FAMILY',
  ownerId: familyId,
  purchaseDate: null,
  quantity: 6,
  unit: 'liter',
  updatedAt: '2026-09-30T13:00:00.000Z',
};

const createUseCaseMock = { execute: jest.fn() };
const deleteUseCaseMock = { execute: jest.fn() };
const getByIdUseCaseMock = { execute: jest.fn() };
const getListUseCaseMock = { execute: jest.fn() };
const getUserFamilyIdsUseCaseMock = { execute: jest.fn() };
const updateUseCaseMock = { execute: jest.fn() };

// endregion Mocks

let setup: StockService;

beforeEach(async () => {
  jest.clearAllMocks();
  createUseCaseMock.execute.mockResolvedValue(itemResultMock);
  deleteUseCaseMock.execute.mockResolvedValue(undefined);
  getByIdUseCaseMock.execute.mockResolvedValue(itemResultMock);
  getListUseCaseMock.execute.mockResolvedValue([itemResultMock]);
  getUserFamilyIdsUseCaseMock.execute.mockResolvedValue([familyId]);
  updateUseCaseMock.execute.mockResolvedValue(itemResultMock);

  const module = await Test.createTestingModule({
    providers: [
      StockService,
      { provide: CreateStockItemUseCase, useValue: createUseCaseMock },
      { provide: DeleteStockItemUseCase, useValue: deleteUseCaseMock },
      { provide: GetStockItemByIdUseCase, useValue: getByIdUseCaseMock },
      { provide: GetStockItemsUseCase, useValue: getListUseCaseMock },
      { provide: GetUserFamilyIdsUseCase, useValue: getUserFamilyIdsUseCaseMock },
      { provide: UpdateStockItemUseCase, useValue: updateUseCaseMock },
    ],
  }).compile();

  setup = module.get(StockService);
});

const mocks = {
  accessibleOwners,
  createUseCase: createUseCaseMock,
  deleteUseCase: deleteUseCaseMock,
  familyId,
  getByIdUseCase: getByIdUseCaseMock,
  getListUseCase: getListUseCaseMock,
  getUserFamilyIdsUseCase: getUserFamilyIdsUseCaseMock,
  itemApi: itemApiMock,
  updateUseCase: updateUseCaseMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
