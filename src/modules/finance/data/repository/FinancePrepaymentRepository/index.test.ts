import { mocks, setup } from './index.mocks';

it('SHOULD map the prepayment found by plan, or undefined', async () => {
  mocks.datasource.findByPlanId.mockResolvedValueOnce(mocks.raw);

  expect(await setup.findByPlanId('plan-1')).toMatchObject({ discount: 12000, id: 'prepayment-1' });

  mocks.datasource.findByPlanId.mockResolvedValueOnce(null);

  expect(await setup.findByPlanId('plan-1')).toBeUndefined();
});

it('SHOULD send the prepayment to the datasource with snake_case columns', async () => {
  mocks.datasource.prepay.mockResolvedValue(mocks.raw);

  const result = await setup.prepay({
    categoryId: 'cat-3',
    creditCardId: 'card-1',
    date: '2026-10-16',
    discount: 12000,
    discountDescription: 'Prepayment discount · Notebook',
    owner: 'USER' as never,
    ownerId: 'owner-1',
    planId: 'plan-1',
    targetInvoiceMonth: '2026-10',
  });

  expect(result.targetInvoiceMonth).toBe('2026-10');
  expect(mocks.datasource.prepay).toHaveBeenCalledWith(
    expect.objectContaining({
      category_id: 'cat-3',
      discount: 12000,
      plan_id: 'plan-1',
      target_invoice_month: '2026-10',
    }),
  );
});

it('SHOULD undo through the datasource', async () => {
  await setup.undoPrepayment('plan-1');

  expect(mocks.datasource.undo).toHaveBeenCalledWith('plan-1');
});
