import { faker } from '@faker-js/faker';

import {
  IncomeCategory,
  IncomeEntity,
  IncomeEventEntity,
  IncomeSuggestionEntity,
} from '@investment/domain/entity/IncomeEntity';
import {
  InvestmentAssetClass,
  InvestmentIncomeType,
  InvestmentSuggestionStatus,
} from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { IIncomeRepository } from '@investment/domain/repository';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export function incomeCategoryFixture(overrides: Partial<IncomeCategory> = {}): IncomeCategory {
  return {
    allScopes: false,
    archived: false,
    id: 'cat-1',
    isIncome: true,
    isSystem: false,
    owner: OwnerType.USER,
    ownerId: 'user-1',
    scopes: [],
    ...overrides,
  };
}
export function incomeEventFixture(overrides: Partial<IncomeEventEntity> = {}): IncomeEventEntity {
  return {
    amountPerUnit: '0.47',
    currency: 'BRL',
    exDate: '2026-11-21',
    id: faker.string.uuid(),
    market: QuoteMarket.B3,
    paymentDate: '2026-12-19',
    source: 'brapi',
    ticker: 'ITSA4',
    type: InvestmentIncomeType.DIVIDEND,
    ...overrides,
  };
}
export function incomeFixture(overrides: Partial<IncomeEntity> = {}): IncomeEntity {
  return {
    accountId: 'acc-1',
    amountPerUnit: '0.28',
    assetClass: InvestmentAssetClass.BR_STOCK,
    assetId: faker.string.uuid(),
    categoryId: 'cat-1',
    createdAt: new Date('2026-10-30T00:00:00Z'),
    createdBy: 'user-1',
    currency: 'BRL',
    exDate: '2026-09-10',
    id: faker.string.uuid(),
    netAmount: 7140,
    notes: null,
    paid: true,
    paymentDate: '2026-10-30',
    quantity: '300',
    suggestionId: null,
    transactionId: 'tx-1',
    type: InvestmentIncomeType.JCP,
    ...overrides,
  };
}
export function incomeRepositorySpies(): Record<keyof IIncomeRepository, jest.Mock> {
  return {
    countPendingSuggestions: jest.fn(),
    countPendingSuggestionsByAssets: jest.fn(),
    createSuggestions: jest.fn(),
    deleteIncome: jest.fn(),
    findCategoryById: jest.fn(),
    findDefaultAccountId: jest.fn(),
    findEvents: jest.fn(),
    findIncomeById: jest.fn(),
    findIncomeByTransactionId: jest.fn(),
    findIncomes: jest.fn(),
    findLastIncomeCategoryId: jest.fn(),
    findPendingSuggestions: jest.fn(),
    findReceivedByOwners: jest.fn(),
    findSuggestionById: jest.fn(),
    findSuggestionInputs: jest.fn(),
    incomeTotals: jest.fn(),
    rejectSuggestion: jest.fn(),
    runExclusive: jest.fn(),
    upsertEvents: jest.fn(),
    writeIncome: jest.fn(),
  };
}
export function incomeSuggestionFixture(
  overrides: Partial<IncomeSuggestionEntity> = {},
): IncomeSuggestionEntity {
  const event = overrides.event ?? incomeEventFixture();

  return {
    assetId: faker.string.uuid(),
    event,
    eventId: event.id,
    id: faker.string.uuid(),
    quantity: '300',
    status: InvestmentSuggestionStatus.PENDING,
    ...overrides,
  };
}
