import { mocks, setup, spies } from './index.mocks';

describe('Method prepay', () => {
  beforeEach(() => {
    spies.prepaymentFindUnique.mockResolvedValue(null);
    spies.paymentFindFirst.mockResolvedValue(null);
    spies.paymentFindMany.mockResolvedValue([]);
    spies.transactionFindMany.mockResolvedValue(mocks.eligibleRows);
    spies.prepaymentCreate.mockResolvedValue({ id: 'prepayment-1' });
    spies.transactionCreate.mockResolvedValue({ id: 'discount-1' });
    spies.prepaymentUpdate.mockResolvedValue({ id: 'prepayment-1' });
    spies.prepaymentFindUniqueOrThrow.mockResolvedValue({ id: 'prepayment-1' });
  });

  it('SHOULD lock the card, keep the original months, move the rows AND create the discount row', async () => {
    await setup.prepay(mocks.prepayParams);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.prepaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        original_months: { 'tx-4': '2026-11', 'tx-5': '2026-12' },
        target_invoice_month: '2026-10',
      }),
    });
    expect(spies.transactionUpdateMany).toHaveBeenCalledWith({
      data: { invoice_month: '2026-10', prepayment_id: 'prepayment-1' },
      where: { id: { in: ['tx-4', 'tx-5'] } },
    });
    expect(spies.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category_id: 'cat-3',
        invoice_month: '2026-10',
        type: 'INCOME',
        value: 12000,
      }),
    });
    expect(spies.prepaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { discount_transaction_id: 'discount-1' } }),
    );
  });

  it('SHOULD NOT create a discount row WHEN the discount is 0', async () => {
    await setup.prepay({ ...mocks.prepayParams, discount: 0 });

    expect(spies.transactionCreate).not.toHaveBeenCalled();
    expect(spies.prepaymentFindUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it('SHOULD skip installments whose invoice has a payment record', async () => {
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-12' }]);

    await setup.prepay({ ...mocks.prepayParams, discount: 0 });

    expect(spies.transactionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['tx-4'] } } }),
    );
  });

  it('SHOULD answer 409 WHEN the plan already has a prepayment', async () => {
    spies.prepaymentFindUnique.mockResolvedValue({ id: 'old' });

    await expect(setup.prepay(mocks.prepayParams)).rejects.toThrow('already has a prepayment');
  });

  it('SHOULD answer 422 WHEN the target invoice is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.prepay(mocks.prepayParams)).rejects.toThrow('Invoice is paid');
  });

  it('SHOULD answer 422 WHEN nothing is eligible', async () => {
    spies.transactionFindMany.mockResolvedValue([]);

    await expect(setup.prepay(mocks.prepayParams)).rejects.toThrow('No installment to prepay');
  });

  it('SHOULD answer 400 WHEN the discount is above the moved total', async () => {
    await expect(setup.prepay({ ...mocks.prepayParams, discount: 60001 })).rejects.toThrow(
      'cannot exceed',
    );
    expect(spies.prepaymentCreate).not.toHaveBeenCalled();
  });
});

describe('Method undo', () => {
  beforeEach(() => {
    spies.planFindUnique.mockResolvedValue({ credit_card_id: 'card-1' });
    spies.prepaymentFindUnique.mockResolvedValue({
      id: 'prepayment-1',
      original_months: { 'tx-4': '2026-11', 'tx-5': '2026-12' },
      target_invoice_month: '2026-10',
    });
    spies.paymentFindFirst.mockResolvedValue(null);
  });

  it('SHOULD restore the months, break the discount cycle, delete the discount row AND the record', async () => {
    await setup.undo('plan-1');

    expect(spies.transactionUpdate).toHaveBeenCalledWith({
      data: { invoice_month: '2026-11', prepayment_id: null },
      where: { id: 'tx-4' },
    });
    expect(spies.prepaymentUpdate).toHaveBeenCalledWith({
      data: { discount_transaction_id: null },
      where: { id: 'prepayment-1' },
    });
    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({
      where: { prepayment_id: 'prepayment-1' },
    });
    expect(spies.prepaymentDelete).toHaveBeenCalledWith({ where: { id: 'prepayment-1' } });
  });

  it('SHOULD answer 422 WHEN the target invoice is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p' });

    await expect(setup.undo('plan-1')).rejects.toThrow('Invoice is paid');
    expect(spies.transactionUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the plan or the prepayment does not exist', async () => {
    spies.prepaymentFindUnique.mockResolvedValue(null);
    await expect(setup.undo('plan-1')).rejects.toThrow('no prepayment');

    spies.planFindUnique.mockResolvedValue(null);
    await expect(setup.undo('plan-1')).rejects.toThrow();
  });
});

describe('Method findByPlanId', () => {
  it('SHOULD read the record with its discount value', async () => {
    spies.prepaymentFindUnique.mockResolvedValue({ id: 'prepayment-1' });

    expect(await setup.findByPlanId('plan-1')).toEqual({ id: 'prepayment-1' });
    expect(spies.prepaymentFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { installment_plan_id: 'plan-1' } }),
    );
  });
});
