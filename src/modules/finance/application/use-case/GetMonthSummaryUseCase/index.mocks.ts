import { Test } from '@nestjs/testing';

import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { ProjectedOccurrence } from '@finance/domain/entity/ProjectedOccurrence';
import { InvoiceStatus, RecurrenceFrequency, TransactionType } from '@finance/domain/enum';

import { GetMonthSummaryUseCase } from './index';

let setup: GetMonthSummaryUseCase;

beforeEach(async () => {
  const module = await Test.createTestingModule({ providers: [GetMonthSummaryUseCase] }).compile();

  setup = module.get(GetMonthSummaryUseCase);
});

const month = '2026-11';

function invoice(amount: number, amountDue: number, earlyPaid: number, status: InvoiceStatus) {
  return { invoice: { amount, amountDue, earlyPaid, status } };
}
function projection(overrides: Partial<ProjectedOccurrence>): ProjectedOccurrence {
  return {
    ...new TransactionEntityFixture().build(),
    account: null,
    creditCard: null,
    date: '2026-11-12',
    frequency: RecurrenceFrequency.MONTHLY,
    invoiceListDate: null,
    invoiceMonth: null,
    occurrenceCount: null,
    occurrenceNumber: 1,
    recurrenceId: 'recurrence',
    tags: [],
    type: TransactionType.EXPENSE,
    value: 100,
    ...overrides,
  } as ProjectedOccurrence;
}
function row(type: TransactionType, value: number, paid: boolean) {
  return new TransactionEntityFixture()
    .withDate('2026-11-10')
    .withType(type)
    .withValue(value)
    .withPaid(paid)
    .build();
}

const mocks = { invoice, month, projection, row };
const spies = {};

export { mocks, setup, spies };
