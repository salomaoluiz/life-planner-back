import { faker } from '@faker-js/faker';

import { FinancialCreditCard } from '@db/client';

// region Mocks

const rawCardMock: FinancialCreditCard = {
  brand: 'MASTERCARD',
  closing_day: 31,
  color: '#3B5BDB',
  created_at: faker.date.past(),
  currency: 'BRL' as const,
  due_day: 10,
  id: faker.string.uuid(),
  last_digits: '9876',
  limit: 500000,
  owner: 'FAMILY',
  owner_id: faker.string.uuid(),
  payment_account_id: faker.string.uuid(),
  payment_day: 5,
  status: 'ARCHIVED',
  title: 'Travel',
  updated_at: faker.date.recent(),
};

// endregion Mocks

export const mocks = { raw: rawCardMock };
