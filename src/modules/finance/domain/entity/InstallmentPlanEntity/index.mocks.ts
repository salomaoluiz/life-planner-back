import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import InstallmentPlanEntity from './index';

// region Mocks

const paramsMock: InstallmentPlanEntity = {
  categoryId: 'category-uuid-1',
  createdAt: new Date('2026-10-04T12:00:00.000Z'),
  creditCardId: 'card-uuid-1',
  currency: 'BRL' as const,
  date: '2026-10-20',
  description: 'Notebook',
  id: 'plan-uuid-1',
  installmentCount: 10,
  installments: [],
  notes: null,
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-1',
  prepayment: null,
  totalValue: 512000,
  updatedAt: new Date('2026-10-04T13:00:00.000Z'),
};

// endregion Mocks

function setup(params = paramsMock) {
  return new InstallmentPlanEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
