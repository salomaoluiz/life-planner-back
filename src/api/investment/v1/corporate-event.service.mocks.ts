import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { CorporateEventService } from '@api/investment/v1/corporate-event.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { ApproveEventSuggestionUseCase } from '@investment/application/use-case/ApproveEventSuggestionUseCase';
import { CreateFractionSaleUseCase } from '@investment/application/use-case/CreateFractionSaleUseCase';
import { GetEventSuggestionsUseCase } from '@investment/application/use-case/GetEventSuggestionsUseCase';
import { RejectEventSuggestionUseCase } from '@investment/application/use-case/RejectEventSuggestionUseCase';
import { assetFixture, operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const asset = assetFixture({ ownerId: userId });
const operation = operationFixture({
  assetId: asset.id,
  fractionOfOperationId: faker.string.uuid(),
  quantity: Decimal8.parse('0.5'),
});
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
const writeResult = {
  asset: { asset, position },
  operation: { costRemoved: 506, event: null, operation, realizedResult: 14 },
};
const suggestionPage = {
  items: [
    {
      assetId: asset.id,
      averagePriceAfter: '9.61109827',
      averagePriceBefore: null as null | string,
      bonusPercent: '10',
      bonusUnitCost: null as null | string,
      currency: 'BRL',
      date: '2026-11-18',
      fractionQuantity: '0.5',
      id: faker.string.uuid(),
      quantity: '315',
      quantityAfter: '346',
      quantityBefore: '315',
      ratioFrom: null as null | string,
      ratioTo: null as null | string,
      ticker: 'MGLU3',
      type: 'BONUS',
    },
  ],
  nextCursor: null as null | string,
};

const useCaseMocks = {
  approve: { execute: jest.fn() },
  createFractionSale: { execute: jest.fn() },
  getFamilyAccess: { execute: jest.fn() },
  getSuggestions: { execute: jest.fn() },
  reject: { execute: jest.fn() },
};

let setup: CorporateEventService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCaseMocks.getFamilyAccess.execute.mockResolvedValue([{ archived: true, familyId }]);

  const module = await Test.createTestingModule({
    providers: [
      CorporateEventService,
      { provide: ApproveEventSuggestionUseCase, useValue: useCaseMocks.approve },
      { provide: CreateFractionSaleUseCase, useValue: useCaseMocks.createFractionSale },
      { provide: GetEventSuggestionsUseCase, useValue: useCaseMocks.getSuggestions },
      { provide: GetUserFamilyAccessUseCase, useValue: useCaseMocks.getFamilyAccess },
      { provide: RejectEventSuggestionUseCase, useValue: useCaseMocks.reject },
    ],
  }).compile();

  setup = module.get(CorporateEventService);
});

const mocks = {
  accessibleOwners: [
    { owner: OwnerType.USER, ownerId: userId },
    { archived: true, owner: OwnerType.FAMILY, ownerId: familyId },
  ],
  operation,
  suggestionPage,
  useCases: useCaseMocks,
  userId,
  writeResult,
};

export { mocks, setup };
