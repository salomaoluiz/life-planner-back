import { setup, spies } from './index.mocks';

const where = { owner: 'USER', owner_id: 'user-id' };

it('SHOULD delete the referencing rows first, then everything of ONE owner in ONE transaction AND return the total', async () => {
  const order: string[] = [];

  spies.transactionDeleteMany.mockImplementation(async (args: { where: object }) => {
    order.push(`tx:${JSON.stringify(args.where)}`);

    return { count: 2 };
  });
  spies.prepaymentUpdateMany.mockImplementation(async () => {
    order.push('prepayment:unlink');

    return { count: 1 };
  });
  spies.prepaymentDeleteMany.mockImplementation(async () => {
    order.push('prepayment:delete');

    return { count: 1 };
  });
  spies.paymentDeleteMany.mockImplementation(async () => {
    order.push('payment');

    return { count: 1 };
  });
  spies.recurrenceDeleteMany.mockImplementation(async () => {
    order.push('recurrence');

    return { count: 1 };
  });
  spies.planDeleteMany.mockImplementation(async () => {
    order.push('plan');

    return { count: 1 };
  });
  spies.creditCardDeleteMany.mockResolvedValue({ count: 1 });
  spies.categoryDeleteMany.mockResolvedValue({ count: 3 });
  spies.accountDeleteMany.mockResolvedValue({ count: 2 });
  spies.tagDeleteMany.mockResolvedValue({ count: 5 });

  const result = await setup.deleteAllByOwner({ owner: 'USER', owner_id: 'user-id' });

  expect(order.map((step) => step.slice(0, 18))).toEqual([
    'tx:{"paid_from_tra',
    'tx:{"owner":"USER"',
    'prepayment:unlink',
    'tx:{"owner":"USER"',
    'prepayment:delete',
    'payment',
    'tx:{"owner":"USER"',
    'recurrence',
    'plan',
  ]);
  expect(spies.prepaymentUpdateMany).toHaveBeenCalledWith({
    data: { discount_transaction_id: null },
    where,
  });
  expect(spies.transactionDeleteMany).toHaveBeenNthCalledWith(1, {
    where: { paid_from_transaction: { is: where } },
  });
  expect(spies.transactionDeleteMany).toHaveBeenNthCalledWith(4, { where });
  expect(result).toBe(2 * 4 + 1 + 1 + 1 + 1 + 1 + 1 + 3 + 5 + 2);
  expect(spies.tagDeleteMany).toHaveBeenCalledWith({ where });
});

it('SHOULD return 0 WHEN the owner has nothing (second call of a retry)', async () => {
  [
    spies.transactionDeleteMany,
    spies.prepaymentUpdateMany,
    spies.prepaymentDeleteMany,
    spies.paymentDeleteMany,
    spies.planDeleteMany,
    spies.creditCardDeleteMany,
    spies.categoryDeleteMany,
    spies.accountDeleteMany,
  ].forEach((spy) => spy.mockResolvedValue({ count: 0 }));

  expect(await setup.deleteAllByOwner({ owner: 'FAMILY', owner_id: 'family-id' })).toBe(0);
});

it('SHOULD propagate a failure (Prisma rolls everything back)', async () => {
  spies.transactionDeleteMany.mockRejectedValueOnce(new Error('fk violation'));

  await expect(setup.deleteAllByOwner({ owner: 'USER', owner_id: 'user-id' })).rejects.toThrow(
    'fk violation',
  );
});
