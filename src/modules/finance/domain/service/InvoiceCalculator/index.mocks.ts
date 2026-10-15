import { BillingCard } from './index';

// region Mocks

function buildCard(overrides: Partial<BillingCard> = {}): BillingCard {
  return {
    closingDay: 10,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    dueDay: 20,
    limit: 500000,
    paymentDay: undefined,
    ...overrides,
  };
}

// endregion Mocks

const mocks = { buildCard };
const spies = {};

export { mocks, spies };
