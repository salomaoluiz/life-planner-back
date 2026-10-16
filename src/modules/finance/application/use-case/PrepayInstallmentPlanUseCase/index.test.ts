import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

import { AccountStatus } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

it('SHOULD prepay with the discount row described after the plan AND return the plan', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.prepaymentRepository.prepay).toHaveBeenCalledWith({
    categoryId: '00000000-0000-4000-8000-000000000003',
    creditCardId: mocks.card.id,
    date: '2026-10-16',
    discount: 120,
    discountDescription: `Prepayment discount · ${mocks.plan.description}`,
    owner: mocks.card.owner,
    ownerId: mocks.card.ownerId,
    planId: mocks.plan.id,
    targetInvoiceMonth: '2026-10',
  });
  expect(result).toBe(mocks.details);
});

it('SHOULD send discount 0 WHEN none is given', async () => {
  await setup.execute({ ...mocks.input, discount: undefined });

  expect(mocks.prepaymentRepository.prepay).toHaveBeenCalledWith(
    expect.objectContaining({ discount: 0 }),
  );
});

it('SHOULD answer 400 WHEN the discount is above the moved total', async () => {
  await expect(setup.execute({ ...mocks.input, discount: 6667 })).rejects.toThrow(
    BadRequestException,
  );
  expect(mocks.prepaymentRepository.prepay).not.toHaveBeenCalled();
});

it('SHOULD answer 422 WHEN the card is archived', async () => {
  mocks.preview.execute.mockResolvedValue({
    card: { ...mocks.card, status: AccountStatus.ARCHIVED },
    eligible: [],
    plan: mocks.plan,
    total: 6666,
  });

  await expect(setup.execute(mocks.input)).rejects.toThrow(UnprocessableEntityException);
});
