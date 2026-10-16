import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the card AND return the row', async () => {
    spies.create.mockResolvedValue(mocks.card);
    const params = {
      brand: 'VISA' as const,
      closing_day: 31,
      color: '#3B5BDB',
      due_day: 10,
      last_digits: '1234',
      limit: 500000,
      owner: 'USER' as const,
      owner_id: mocks.card.owner_id,
      payment_day: 5,
      status: 'ACTIVE' as const,
      title: 'Main card',
    };

    expect(await setup.create(params)).toEqual(mocks.card);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.card.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.card.id } });
  });
});

describe('Method exists', () => {
  const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

  it('SHOULD return true WHEN the owner has a card (select the id only)', async () => {
    spies.findFirst.mockResolvedValue({ id: mocks.card.id });

    expect(await setup.exists(params)).toBe(true);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });

  it('SHOULD return false WHEN there is none', async () => {
    spies.findFirst.mockResolvedValue(null);

    expect(await setup.exists(params)).toBe(false);
  });
});

describe('Method findById', () => {
  it('SHOULD return the row, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.card).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.card.id)).toEqual(mocks.card);
    expect(await setup.findById('missing')).toBeNull();
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every (owner, owner_id) pair in ONE findMany', async () => {
    spies.findMany.mockResolvedValue([mocks.card]);

    await setup.findByOwners(mocks.owners);

    expect(spies.findMany).toHaveBeenCalledTimes(1);
    expect(spies.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { owner: 'USER', owner_id: mocks.owners[0].ownerId },
          { owner: 'FAMILY', owner_id: mocks.owners[1].ownerId },
        ],
      },
    });
  });

  it('SHOULD add the status filter WHEN given', async () => {
    spies.findMany.mockResolvedValue([]);

    await setup.findByOwners(mocks.owners, 'ACTIVE');

    expect(spies.findMany).toHaveBeenCalledWith({
      where: { OR: expect.any(Array), status: 'ACTIVE' },
    });
  });
});

describe('Method update', () => {
  it('SHOULD forward only the given columns (undefined is skipped, null clears)', async () => {
    spies.update.mockResolvedValue(mocks.card);

    await setup.update({ id: mocks.card.id, payment_day: null, title: 'Renamed' });

    expect(spies.update).toHaveBeenCalledWith({
      data: {
        brand: undefined,
        closing_day: undefined,
        color: undefined,
        due_day: undefined,
        last_digits: undefined,
        limit: undefined,
        owner: undefined,
        owner_id: undefined,
        payment_day: null,
        status: undefined,
        title: 'Renamed',
      },
      where: { id: mocks.card.id },
    });
  });
});

describe('Method update with a new closing day (spec 029 FR 9)', () => {
  it('SHOULD lock the card, update it AND recompute ONLY the purchases of unpaid invoices that move', async () => {
    spies.update.mockResolvedValue(mocks.card);
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-09' }]);
    spies.txFindMany.mockResolvedValue([
      { date: new Date('2026-10-20T00:00:00.000Z'), id: 'moves', invoice_month: '2026-10' },
      { date: new Date('2026-10-05T00:00:00.000Z'), id: 'stays', invoice_month: '2026-10' },
    ]);

    await setup.update({ closing_day: 15, id: mocks.card.id });

    expect(spies.transaction).toHaveBeenCalledTimes(1);
    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.txFindMany).toHaveBeenCalledWith({
      select: { date: true, id: true, invoice_month: true },
      where: {
        credit_card_id: mocks.card.id,
        installment_plan_id: null,
        invoice_month: { notIn: ['2026-09'] },
      },
    });
    expect(spies.txUpdateMany).toHaveBeenCalledTimes(1);
    expect(spies.txUpdateMany).toHaveBeenCalledWith({
      data: { invoice_month: '2026-11' },
      where: { id: { in: ['moves'] } },
    });
  });

  it('SHOULD NOT move a purchase into an invoice that is already paid', async () => {
    spies.update.mockResolvedValue(mocks.card);
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-11' }]);
    spies.txFindMany.mockResolvedValue([
      { date: new Date('2026-10-20T00:00:00.000Z'), id: 'blocked', invoice_month: '2026-10' },
    ]);

    await setup.update({ closing_day: 15, id: mocks.card.id });

    expect(spies.txUpdateMany).not.toHaveBeenCalled();
  });
});

describe('Method update with a new closing day: installments (spec 030 FR 18)', () => {
  function plan(rows: [string, string][]) {
    return {
      date: new Date('2026-10-20T00:00:00.000Z'),
      id: 'plan-1',
      transactions: rows.map(([id, invoice_month]) => ({ id, invoice_month })),
    };
  }

  beforeEach(() => {
    spies.update.mockResolvedValue(mocks.card);
    spies.txFindMany.mockResolvedValue([]);
  });

  it('SHOULD shift every unpaid installment consecutively from the new first invoice', async () => {
    spies.paymentFindMany.mockResolvedValue([]);
    spies.planFindMany.mockResolvedValue([
      plan([
        ['r1', '2026-10'],
        ['r2', '2026-11'],
        ['r3', '2026-12'],
      ]),
    ]);

    // Purchase on 2026-10-20 with closing day 15 → first invoice 2026-11.
    await setup.update({ closing_day: 15, id: mocks.card.id });

    expect(spies.txUpdate).toHaveBeenCalledTimes(3);
    expect(spies.txUpdate).toHaveBeenNthCalledWith(1, {
      data: { invoice_month: '2026-11' },
      where: { id: 'r1' },
    });
    expect(spies.txUpdate).toHaveBeenNthCalledWith(3, {
      data: { invoice_month: '2027-01' },
      where: { id: 'r3' },
    });
  });

  it('SHOULD keep a paid installment AND push the later ones after it (never onto a paid month)', async () => {
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-10' }]);
    spies.planFindMany.mockResolvedValue([
      plan([
        ['r1', '2026-10'],
        ['r2', '2026-11'],
        ['r3', '2026-12'],
      ]),
    ]);

    // Closing day 31 keeps the first invoice in 2026-10, but that month is paid by row 1 itself.
    await setup.update({ closing_day: 31, id: mocks.card.id });

    expect(spies.txUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD move later unpaid rows past a paid one WHEN the new rule would collide with it', async () => {
    spies.paymentFindMany.mockResolvedValue([{ invoice_month: '2026-11' }]);
    spies.planFindMany.mockResolvedValue([
      plan([
        ['r1', '2026-10'],
        ['r2', '2026-11'],
        ['r3', '2026-12'],
      ]),
    ]);

    // New first invoice is 2026-11, which row 2 (paid) already holds: row 1 can't fit before it.
    await setup.update({ closing_day: 15, id: mocks.card.id });

    expect(spies.txUpdate).toHaveBeenCalledWith({
      data: { invoice_month: '2026-12' },
      where: { id: 'r1' },
    });
  });
});
