import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import PrepaymentEntity from './index';

// region Mocks

const paramsMock: PrepaymentEntity = {
  createdAt: new Date('2026-10-16T12:00:00.000Z'),
  date: '2026-10-16',
  discount: 12000,
  discountTransactionId: 'discount-uuid-1',
  id: 'prepayment-uuid-1',
  installmentPlanId: 'plan-uuid-1',
  originalMonths: { 'tx-4': '2026-11', 'tx-5': '2026-12' },
  owner: OwnerType.USER,
  ownerId: 'owner-uuid-1',
  targetInvoiceMonth: '2026-10',
  updatedAt: new Date('2026-10-16T13:00:00.000Z'),
};

// endregion Mocks

function setup(params = paramsMock) {
  return new PrepaymentEntity(params);
}

const mocks = { params: paramsMock };
const spies = {};

export { mocks, setup, spies };
