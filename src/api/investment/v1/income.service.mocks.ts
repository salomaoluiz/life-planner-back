import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { IncomeService } from '@api/investment/v1/income.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { IncomeView } from '@investment/application/service/IncomeRules';
import { ApproveIncomeSuggestionUseCase } from '@investment/application/use-case/ApproveIncomeSuggestionUseCase';
import { CreateIncomeUseCase } from '@investment/application/use-case/CreateIncomeUseCase';
import { DeleteIncomeUseCase } from '@investment/application/use-case/DeleteIncomeUseCase';
import { GetIncomeByIdUseCase } from '@investment/application/use-case/GetIncomeByIdUseCase';
import { GetIncomeDefaultsUseCase } from '@investment/application/use-case/GetIncomeDefaultsUseCase';
import { GetIncomeSuggestionsUseCase } from '@investment/application/use-case/GetIncomeSuggestionsUseCase';
import { GetIncomesUseCase } from '@investment/application/use-case/GetIncomesUseCase';
import { ReceiveIncomeUseCase } from '@investment/application/use-case/ReceiveIncomeUseCase';
import { RejectIncomeSuggestionUseCase } from '@investment/application/use-case/RejectIncomeSuggestionUseCase';
import { UpdateIncomeUseCase } from '@investment/application/use-case/UpdateIncomeUseCase';
import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const familyId = faker.string.uuid();
const view: IncomeView = {
  estimatedGross: 8400,
  estimatedWithheld: 1260,
  income: incomeFixture({
    accountId: faker.string.uuid(),
    categoryId: faker.string.uuid(),
    transactionId: faker.string.uuid(),
  }),
  overdue: false,
  status: 'RECEIVED',
  withholdingRate: '0.15',
};
const bareView: IncomeView = {
  ...view,
  income: incomeFixture({
    accountId: null,
    amountPerUnit: null,
    categoryId: null,
    exDate: null,
    notes: null,
    quantity: null,
    suggestionId: null,
    transactionId: null,
  }),
};
const suggestion = {
  amountPerUnit: '0.47',
  assetId: faker.string.uuid(),
  canApproveDirectly: true,
  currency: 'BRL',
  estimatedGross: 14100,
  estimatedNet: 14100,
  exDate: '2026-11-21',
  id: faker.string.uuid(),
  paymentDate: '2026-12-19' as null | string,
  quantity: '300',
  ticker: 'PETR4',
  type: 'DIVIDEND' as never,
  withholdingRate: '0',
};

const useCases = {
  approve: { execute: jest.fn() },
  create: { execute: jest.fn() },
  delete: { execute: jest.fn() },
  family: { execute: jest.fn() },
  findById: { execute: jest.fn() },
  findDefaults: { execute: jest.fn() },
  findIncomes: { execute: jest.fn() },
  findSuggestions: { execute: jest.fn() },
  receive: { execute: jest.fn() },
  reject: { execute: jest.fn() },
  update: { execute: jest.fn() },
};

// endregion Mocks

let setup: IncomeService;

beforeEach(async () => {
  jest.resetAllMocks();
  useCases.family.execute.mockResolvedValue([{ archived: true, familyId }]);

  const module = await Test.createTestingModule({
    providers: [
      IncomeService,
      { provide: ApproveIncomeSuggestionUseCase, useValue: useCases.approve },
      { provide: CreateIncomeUseCase, useValue: useCases.create },
      { provide: DeleteIncomeUseCase, useValue: useCases.delete },
      { provide: GetIncomeByIdUseCase, useValue: useCases.findById },
      { provide: GetIncomeDefaultsUseCase, useValue: useCases.findDefaults },
      { provide: GetIncomeSuggestionsUseCase, useValue: useCases.findSuggestions },
      { provide: GetIncomesUseCase, useValue: useCases.findIncomes },
      { provide: GetUserFamilyAccessUseCase, useValue: useCases.family },
      { provide: ReceiveIncomeUseCase, useValue: useCases.receive },
      { provide: RejectIncomeSuggestionUseCase, useValue: useCases.reject },
      { provide: UpdateIncomeUseCase, useValue: useCases.update },
    ],
  }).compile();

  setup = module.get(IncomeService);
});

const mocks = {
  bareView,
  familyId,
  owners: [
    { owner: OwnerType.USER, ownerId: userId },
    { archived: true, owner: OwnerType.FAMILY, ownerId: familyId },
  ],
  suggestion,
  useCases,
  userId,
  view,
};

export { mocks, setup };
