import { faker } from '@faker-js/faker';

import { FinancialRecurrenceWithRelations } from '@finance/data/repository/datasource/IFinanceRecurrenceDatasource';

// region Mocks

const rawRecurrenceMock: FinancialRecurrenceWithRelations = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  account_id: faker.string.uuid(),
  category: {
    exclude_from_totals: false,
    icon: 'home',
    icon_color: '#2E7D32',
    id: faker.string.uuid(),
    name: 'Rent',
    system_key: null,
  },
  category_id: faker.string.uuid(),
  created_at: faker.date.past(),
  credit_card: null,
  credit_card_id: null,
  currency: 'BRL' as const,
  description: 'Rent',
  end_date: new Date('2027-09-05T00:00:00.000Z'),
  first_number: 1,
  frequency: 'MONTHLY',
  id: faker.string.uuid(),
  last_generated_number: 1,
  next_occurrence_date: new Date('2026-11-05T00:00:00.000Z'),
  notes: null,
  owner: 'USER',
  owner_id: faker.string.uuid(),
  skipped_numbers: [3],
  start_date: new Date('2026-10-05T00:00:00.000Z'),
  status: 'ACTIVE',
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
  value: 200000,
};

// endregion Mocks

export const mocks = { raw: rawRecurrenceMock };
