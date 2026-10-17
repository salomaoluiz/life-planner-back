import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { mocks, setup } from './index.mocks';

const cardId = mocks.plan.creditCardId;

it('SHOULD return no cap for a standalone refund', async () => {
  expect(await setup.execute({ creditCardId: cardId })).toEqual({});
});

it('SHOULD cap a refund linked to a purchase at the purchase value', async () => {
  expect(await setup.execute({ creditCardId: cardId, refundedTransactionId: 'p' })).toEqual({
    cap: 50000,
    name: mocks.purchase.description,
  });
});

it('SHOULD cap a refund linked to a plan at the SUM of its installments', async () => {
  expect(await setup.execute({ creditCardId: cardId, refundedPlanId: 'plan' })).toEqual({
    cap: 10000,
    name: 'Notebook',
  });
});

it('SHOULD answer 400 WHEN both links are sent', async () => {
  await expect(
    setup.execute({ creditCardId: cardId, refundedPlanId: 'a', refundedTransactionId: 'b' }),
  ).rejects.toThrow(BadRequestException);
});

it('SHOULD answer 422 for a link on another card AND for an installment row', async () => {
  await expect(
    setup.execute({ creditCardId: 'other-card', refundedTransactionId: 'p' }),
  ).rejects.toThrow('another card');
  await expect(setup.execute({ creditCardId: 'other-card', refundedPlanId: 'p' })).rejects.toThrow(
    UnprocessableEntityException,
  );

  mocks.transactionRepository.findTransactionById.mockResolvedValue({
    ...mocks.purchase,
    installmentPlanId: 'plan',
  });
  await expect(setup.execute({ creditCardId: cardId, refundedTransactionId: 'p' })).rejects.toThrow(
    'Link the plan instead',
  );
});

it('SHOULD answer 404 WHEN the purchase or the plan does not exist', async () => {
  mocks.transactionRepository.findTransactionById.mockResolvedValue(undefined);
  mocks.planRepository.findPlanById.mockResolvedValue(undefined);

  await expect(setup.execute({ creditCardId: cardId, refundedTransactionId: 'p' })).rejects.toThrow(
    NotFoundException,
  );
  await expect(setup.execute({ creditCardId: cardId, refundedPlanId: 'p' })).rejects.toThrow(
    NotFoundException,
  );
});
