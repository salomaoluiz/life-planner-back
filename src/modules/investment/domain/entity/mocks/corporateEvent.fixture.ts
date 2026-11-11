import { faker } from '@faker-js/faker';

import {
  CorporateEventEntity,
  EventSuggestionEntity,
} from '@investment/domain/entity/CorporateEventEntity';
import { InvestmentCorporateEventType, InvestmentSuggestionStatus } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { ICorporateEventRepository } from '@investment/domain/repository';

export function corporateEventFixture(
  overrides: Partial<CorporateEventEntity> = {},
): CorporateEventEntity {
  return {
    bonusPercent: null,
    bonusUnitCost: null,
    currency: 'BRL',
    id: faker.string.uuid(),
    market: QuoteMarket.B3,
    ratioFrom: '10',
    ratioTo: '1',
    recordDate: '2026-03-10',
    ticker: 'MGLU3',
    type: InvestmentCorporateEventType.REVERSE_SPLIT,
    ...overrides,
  };
}
export function corporateEventRepositorySpies(): Record<
  keyof ICorporateEventRepository,
  jest.Mock
> {
  return {
    countPendingByAsset: jest.fn(),
    createSuggestions: jest.fn(),
    findEvents: jest.fn(),
    findPendingSuggestions: jest.fn(),
    findSuggestionById: jest.fn(),
    findSuggestionInputs: jest.fn(),
    rejectSuggestion: jest.fn(),
    runExclusive: jest.fn(),
    upsertEvents: jest.fn(),
  };
}
export function eventSuggestionFixture(
  overrides: Partial<EventSuggestionEntity> = {},
): EventSuggestionEntity {
  const event = overrides.event ?? corporateEventFixture();

  return {
    assetId: faker.string.uuid(),
    event,
    eventId: event.id,
    id: faker.string.uuid(),
    quantity: '3155',
    status: InvestmentSuggestionStatus.PENDING,
    ...overrides,
  };
}
