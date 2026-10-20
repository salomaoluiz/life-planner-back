import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

const date = new Date('2026-10-20T00:00:00.000Z');

describe('Method create', () => {
  const params = {
    category_id: 'cat-1',
    credit_card_id: 'card-1',
    currency: 'BRL' as const,
    date,
    description: 'Notebook',
    owner: 'USER' as const,
    owner_id: 'owner-1',
    rows: mocks.rows,
  };

  it('SHOULD lock the card, then insert the plan AND one numbered row per installment in ONE transaction', async () => {
    spies.planCreate.mockResolvedValue({ id: 'plan-1' });

    expect(await setup.create(params)).toBe('plan-1');
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.queryRaw.mock.calls[0][0].sql).toContain('FOR UPDATE');
    expect(spies.planCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ installment_count: 3, total_value: 10000 }),
      select: { id: true },
    });
    const { data } = spies.rowCreateMany.mock.calls[0][0];

    expect(data).toHaveLength(3);
    expect(data[0]).toEqual(
      expect.objectContaining({
        credit_card_id: 'card-1',
        installment_number: 1,
        installment_plan_id: 'plan-1',
        invoice_month: '2026-10',
        type: 'EXPENSE',
        value: 3334,
      }),
    );
    expect(data[2].installment_number).toBe(3);
  });

  it('SHOULD resolve the tag names in the owner AND attach them to every row (spec 043)', async () => {
    spies.planCreate.mockResolvedValue({ id: 'plan-1' });
    spies.tagFindMany.mockResolvedValue([{ all_scopes: false, id: 'tag-old', name: 'Viagem' }]);
    spies.tagCreate.mockResolvedValue({ id: 'tag-new' });
    spies.rowFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

    await setup.create({ ...params, tag_names: ['viagem', 'presente'] });

    expect(spies.tagCreate).toHaveBeenCalledWith({
      data: { creator_id: 'owner-1', name: 'presente', owner: 'USER', owner_id: 'owner-1' },
      select: { id: true },
    });
    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
      data: [
        { position: 0, tag_id: 'tag-old', transaction_id: 'r1' },
        { position: 1, tag_id: 'tag-new', transaction_id: 'r1' },
        { position: 0, tag_id: 'tag-old', transaction_id: 'r2' },
        { position: 1, tag_id: 'tag-new', transaction_id: 'r2' },
      ],
    });
  });

  it('SHOULD write nothing WHEN a target invoice is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.create(params)).rejects.toThrow('Invoice is paid');
    expect(spies.planCreate).not.toHaveBeenCalled();
    expect(spies.rowCreateMany).not.toHaveBeenCalled();
  });
});

describe('Method delete', () => {
  it('SHOULD delete the rows, then the plan', async () => {
    await setup.delete('plan-1');

    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { installment_plan_id: 'plan-1' } });
    expect(spies.planDelete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
  });

  it('SHOULD break the prepayment cycle, drop the discount row, the rows AND the record (spec 032 FR 19)', async () => {
    spies.prepaymentFindUnique.mockResolvedValue({ id: 'prepayment-1' });

    await setup.delete('plan-1');

    expect(spies.prepaymentUpdate).toHaveBeenCalledWith({
      data: { discount_transaction_id: null },
      where: { id: 'prepayment-1' },
    });
    expect(spies.rowDeleteMany).toHaveBeenCalledWith({
      where: { installment_plan_id: null, prepayment_id: 'prepayment-1' },
    });
    expect(spies.prepaymentDelete).toHaveBeenCalledWith({ where: { id: 'prepayment-1' } });
    expect(spies.planDelete).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
  });

  it('SHOULD refuse WHEN an installment is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.delete('plan-1')).rejects.toThrow('An installment is in a paid invoice');
    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the plan does not exist', async () => {
    spies.planFindUnique.mockResolvedValue(null);

    await expect(setup.delete('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('Method findManyByCategoryIds', () => {
  it('SHOULD query the plans of the categories with their card closing day', async () => {
    spies.planFindMany.mockResolvedValue([{ id: 'plan-1' }]);

    expect(await setup.findManyByCategoryIds(['cat-1', 'cat-2'])).toEqual([{ id: 'plan-1' }]);
    expect(spies.planFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ credit_card: { select: { closing_day: true } } }),
        where: { category_id: { in: ['cat-1', 'cat-2'] } },
      }),
    );
  });
});

describe('Method findManyByOwners', () => {
  it('SHOULD query the plans of the owners with their card closing day', async () => {
    spies.planFindMany.mockResolvedValue([{ id: 'plan-1' }]);
    const owners = [{ owner: 'FAMILY' as never, ownerId: 'family-1' }];

    expect(await setup.findManyByOwners(owners)).toEqual([{ id: 'plan-1' }]);
    expect(spies.planFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ credit_card: { select: { closing_day: true } } }),
        where: { OR: [{ owner: 'FAMILY', owner_id: 'family-1' }] },
      }),
    );
  });
});

describe('Method findById', () => {
  it('SHOULD load the plan with its rows ordered by number', async () => {
    spies.planFindUnique.mockResolvedValue({ id: 'plan-1' });

    expect(await setup.findById('plan-1')).toEqual({ id: 'plan-1' });
    expect(spies.planFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          prepayment: expect.anything(),
          transactions: expect.objectContaining({ orderBy: { installment_number: 'asc' } }),
        },
        where: { id: 'plan-1' },
      }),
    );
  });
});

describe('Method recreate', () => {
  const params = {
    category_id: 'cat-1',
    credit_card_id: 'card-2',
    date,
    description: 'Notebook',
    id: 'plan-1',
    rows: mocks.rows,
  };

  it('SHOULD replace every row AND update the plan totals', async () => {
    spies.planUpdate.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });

    await setup.recreate(params);

    expect(spies.planUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        credit_card_id: 'card-2',
        installment_count: 3,
        total_value: 10000,
      }),
      where: { id: 'plan-1' },
    });
    expect(spies.rowDeleteMany).toHaveBeenCalledWith({ where: { installment_plan_id: 'plan-1' } });
    expect(spies.rowCreateMany.mock.calls[0][0].data).toHaveLength(3);
  });

  it('SHOULD carry the tags of the first installment over to the new rows', async () => {
    spies.planUpdate.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
    spies.rowFindFirst.mockResolvedValue({ tags: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }] });
    spies.rowFindMany.mockResolvedValue([{ id: 'n1', invoice_month: '2026-10' }]);

    await setup.recreate(params);

    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
      data: [
        { position: 0, tag_id: 'tag-1', transaction_id: 'n1' },
        { position: 1, tag_id: 'tag-2', transaction_id: 'n1' },
      ],
    });
  });

  it('SHOULD tag the new rows with the given names instead (and none for [])', async () => {
    spies.planUpdate.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
    spies.rowFindFirst.mockResolvedValue({ tags: [{ tag_id: 'tag-1' }] });
    spies.rowFindMany.mockResolvedValue([{ id: 'n1', invoice_month: '2026-10' }]);

    await setup.recreate({ ...params, tag_names: [] });

    expect(spies.tagLinkCreateMany).not.toHaveBeenCalled();
  });

  it('SHOULD refuse WHEN an old installment is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(setup.recreate(params)).rejects.toThrow('An installment is in a paid invoice');
    expect(spies.rowDeleteMany).not.toHaveBeenCalled();
  });
});

describe('Method updateFromNumber', () => {
  const where = { installment_number: { gte: 2 }, installment_plan_id: 'plan-1' };

  it('SHOULD refuse a value WHEN one of the rows is paid', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await expect(
      setup.updateFromNumber({ from_number: 2, plan_id: 'plan-1', value: 5 }),
    ).rejects.toThrow('An installment is in a paid invoice');
    expect(spies.rowUpdateMany).not.toHaveBeenCalled();
  });

  it('SHOULD update the value of rows from the number on', async () => {
    await setup.updateFromNumber({ from_number: 2, plan_id: 'plan-1', value: 5 });

    expect(spies.rowUpdateMany).toHaveBeenCalledWith({
      data: { category_id: undefined, description: undefined, value: 5 },
      where,
    });
  });

  it('SHOULD replace the tags of the rows from the number on WHEN names are given', async () => {
    spies.tagCreate.mockResolvedValue({ id: 'tag-new' });
    spies.rowFindMany.mockResolvedValue([{ id: 'r2' }, { id: 'r3' }]);

    await setup.updateFromNumber({ from_number: 2, plan_id: 'plan-1', tag_names: ['novo'] });

    expect(spies.tagLinkDeleteMany).toHaveBeenCalledWith({
      where: { transaction_id: { in: ['r2', 'r3'] } },
    });
    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
      data: [
        { position: 0, tag_id: 'tag-new', transaction_id: 'r2' },
        { position: 0, tag_id: 'tag-new', transaction_id: 'r3' },
      ],
    });
  });

  it('SHOULD allow description and category on paid rows (no payment lookup)', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await setup.updateFromNumber({
      category_id: 'cat-2',
      description: 'New',
      from_number: 2,
      plan_id: 'plan-1',
    });

    expect(spies.paymentFindFirst).not.toHaveBeenCalled();
    expect(spies.rowUpdateMany).toHaveBeenCalledWith({
      data: { category_id: 'cat-2', description: 'New', value: undefined },
      where,
    });
  });
});

describe('Method updateText', () => {
  it('SHOULD rename the plan AND every row, paid ones included', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'payment-1' });

    await setup.updateText({ description: 'New', id: 'plan-1' });

    const data = { category_id: undefined, description: 'New' };

    expect(spies.planUpdate).toHaveBeenCalledWith({ data, where: { id: 'plan-1' } });
    expect(spies.rowUpdateMany).toHaveBeenCalledWith({
      data,
      where: { installment_plan_id: 'plan-1' },
    });
  });

  it('SHOULD set the tags of every row WHEN names are given, none for []', async () => {
    spies.tagFindMany.mockResolvedValue([{ all_scopes: true, id: 'tag-all', name: 'Fixo' }]);
    spies.rowFindMany.mockResolvedValue([{ id: 'r1' }]);

    await setup.updateText({ id: 'plan-1', tag_names: ['fixo'] });

    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({
      data: [{ position: 0, tag_id: 'tag-all', transaction_id: 'r1' }],
    });

    spies.tagLinkCreateMany.mockClear();
    await setup.updateText({ id: 'plan-1', tag_names: [] });

    expect(spies.tagLinkDeleteMany).toHaveBeenLastCalledWith({
      where: { transaction_id: { in: ['r1'] } },
    });
    expect(spies.tagLinkCreateMany).toHaveBeenCalledWith({ data: [] });
  });
});
