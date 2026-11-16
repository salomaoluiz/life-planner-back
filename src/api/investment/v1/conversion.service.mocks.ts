import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { ConversionService } from '@api/investment/v1/conversion.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { CreateConversionUseCase } from '@investment/application/use-case/CreateConversionUseCase';
import { DeleteConversionUseCase } from '@investment/application/use-case/DeleteConversionUseCase';
import { GetConversionByIdUseCase } from '@investment/application/use-case/GetConversionByIdUseCase';
import { UpdateConversionUseCase } from '@investment/application/use-case/UpdateConversionUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const position = {
  averagePrice: null,
  cost: 0,
  currentUnitPrice: null,
  currentValue: null,
  currentValueDate: null,
  openResult: null,
  openResultPercent: null,
  pendingFractions: [],
  quantity: Decimal8.zero(),
  realizedResult: 0,
};
const view = {
  cashAmount: null as null | number,
  cashReferenceUnitValue: null as Decimal8 | null,
  date: '2026-10-15',
  from: {
    assetId: faker.string.uuid(),
    cost: 808550,
    operationId: faker.string.uuid(),
    quantity: Decimal8.parse('103'),
    ticker: 'BCFF11' as null | string,
  },
  id: faker.string.uuid(),
  locked: false,
  ratioFrom: Decimal8.parse('1'),
  ratioTo: Decimal8.parse('7.4'),
  to: {
    assetId: faker.string.uuid(),
    cost: 808550,
    fractionCost: 212,
    fractionQuantity: Decimal8.parse('0.2'),
    operationId: faker.string.uuid(),
    quantity: Decimal8.parse('762'),
    ticker: 'BTHF11' as null | string,
  },
};
const writeResult = {
  fromPosition: { asset: {}, position },
  item: view,
  toPosition: { asset: {}, position },
};

const useCaseMocks = {
  create: { execute: jest.fn() },
  delete: { execute: jest.fn() },
  get: { execute: jest.fn() },
  getFamilyAccess: { execute: jest.fn() },
  update: { execute: jest.fn() },
};

let setup: ConversionService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCaseMocks.getFamilyAccess.execute.mockResolvedValue([{ archived: true, familyId }]);

  const module = await Test.createTestingModule({
    providers: [
      ConversionService,
      { provide: CreateConversionUseCase, useValue: useCaseMocks.create },
      { provide: DeleteConversionUseCase, useValue: useCaseMocks.delete },
      { provide: GetConversionByIdUseCase, useValue: useCaseMocks.get },
      { provide: GetUserFamilyAccessUseCase, useValue: useCaseMocks.getFamilyAccess },
      { provide: UpdateConversionUseCase, useValue: useCaseMocks.update },
    ],
  }).compile();

  setup = module.get(ConversionService);
});

const mocks = {
  accessibleOwners: [
    { owner: OwnerType.USER, ownerId: userId },
    { archived: true, owner: OwnerType.FAMILY, ownerId: familyId },
  ],
  useCases: useCaseMocks,
  userId,
  view,
  writeResult,
};

export { mocks, setup };
