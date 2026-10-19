import { mocks, setup, spies } from './index.mocks';

describe('Method create', () => {
  it('SHOULD insert the account AND return the row', async () => {
    spies.create.mockResolvedValue(mocks.account);
    const params = {
      icon: 'bank',
      initial_balance: 100000,
      ledger_balance: 100000,
      name: 'Checking',
      owner: 'USER' as const,
      owner_id: mocks.account.owner_id,
      status: 'ACTIVE' as const,
    };

    const result = await setup.create(params);

    expect(result).toEqual(mocks.account);
    expect(spies.create).toHaveBeenCalledWith({ data: params });
  });
});

describe('Method delete', () => {
  it('SHOULD delete by id without failing WHEN the row is already gone', async () => {
    spies.deleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete(mocks.account.id)).resolves.toBeUndefined();
    expect(spies.deleteMany).toHaveBeenCalledWith({ where: { id: mocks.account.id } });
  });
});

describe('Method exists', () => {
  const params = { owner: 'FAMILY' as const, owner_id: 'family-id' };

  it('SHOULD return true WHEN the owner has at least one account (cheap select of the id only)', async () => {
    spies.findFirst.mockResolvedValue({ id: mocks.account.id });

    expect(await setup.exists(params)).toBe(true);
    expect(spies.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { owner: 'FAMILY', owner_id: 'family-id' },
    });
  });

  it('SHOULD return false WHEN the owner has none', async () => {
    spies.findFirst.mockResolvedValue(null);

    expect(await setup.exists(params)).toBe(false);
  });
});

describe('Method findById', () => {
  it('SHOULD return the row, or null WHEN not found', async () => {
    spies.findUnique.mockResolvedValueOnce(mocks.account).mockResolvedValueOnce(null);

    expect(await setup.findById(mocks.account.id)).toEqual(mocks.account);
    expect(await setup.findById('missing')).toBeNull();
    expect(spies.findUnique).toHaveBeenCalledWith({ where: { id: mocks.account.id } });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD query every (owner, owner_id) pair in ONE findMany', async () => {
    spies.findMany.mockResolvedValue([mocks.account]);

    const result = await setup.findByOwners(mocks.owners);

    expect(result).toEqual([mocks.account]);
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
});

describe('Method findUnpaidSums', () => {
  it('SHOULD run ONE grouped query over the unpaid rows up to the end of the month', async () => {
    spies.queryRaw.mockResolvedValue([{ account_id: 'acc-1', due_by_end_of_month: BigInt(-400) }]);

    const result = await setup.findUnpaidSums({
      account_ids: ['acc-1', 'acc-2'],
      end_of_month: '2026-10-31',
    });

    expect(result).toEqual([{ account_id: 'acc-1', due_by_end_of_month: -400 }]);
    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    const query = spies.queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('GROUP BY');
    expect(query.sql).toContain('"paid" = false');
    expect(query.sql).toContain('"date" <=');
    expect(query.values).toEqual(expect.arrayContaining(['acc-1', 'acc-2', '2026-10-31']));
  });

  it('SHOULD not query WHEN there are no accounts', async () => {
    expect(await setup.findUnpaidSums({ account_ids: [], end_of_month: '2026-10-31' })).toEqual([]);
    expect(spies.queryRaw).not.toHaveBeenCalled();
  });
});

describe('Method update', () => {
  it('SHOULD update ONLY the editable columns (never owner, owner_id or any balance)', async () => {
    spies.update.mockResolvedValue(mocks.account);

    const result = await setup.update({ id: mocks.account.id, name: 'Renamed' });

    expect(result).toEqual(mocks.account);
    expect(spies.update).toHaveBeenCalledWith({
      data: { icon: undefined, name: 'Renamed', status: undefined },
      where: { id: mocks.account.id },
    });
  });
});

describe('Method findByIds', () => {
  it('SHOULD query by id list in ONE findMany AND skip the query for an empty list', async () => {
    spies.findMany.mockResolvedValue([mocks.account]);

    expect(await setup.findByIds([mocks.account.id])).toEqual([mocks.account]);
    expect(spies.findMany).toHaveBeenCalledWith({ where: { id: { in: [mocks.account.id] } } });

    spies.findMany.mockClear();
    expect(await setup.findByIds([])).toEqual([]);
    expect(spies.findMany).not.toHaveBeenCalled();
  });
});

describe('Method findPaidSumsFrom', () => {
  it('SHOULD run ONE grouped query over the paid rows from the date AND map bigint to number', async () => {
    spies.queryRaw.mockResolvedValue([
      { account_id: 'acc-1', amount: BigInt(-300), date: '2026-11-10' },
    ]);

    const result = await setup.findPaidSumsFrom({ account_ids: ['acc-1'], from: '2026-11-01' });

    expect(result).toEqual([{ account_id: 'acc-1', amount: -300, date: '2026-11-10' }]);
    const query = spies.queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('"paid" = true');
    expect(query.sql).toContain('GROUP BY "account_id", "date"');
    expect(query.values).toEqual(expect.arrayContaining(['acc-1', '2026-11-01']));
  });

  it('SHOULD not query WHEN there are no accounts', async () => {
    expect(await setup.findPaidSumsFrom({ account_ids: [], from: '2026-11-01' })).toEqual([]);
    expect(spies.queryRaw).not.toHaveBeenCalled();
  });
});

describe('Method findUnpaidSumsUntil', () => {
  it('SHOULD run ONE grouped query over the unpaid rows up to the date', async () => {
    spies.queryRaw.mockResolvedValue([
      { account_id: 'acc-1', amount: BigInt(200), date: '2026-11-20' },
    ]);

    const result = await setup.findUnpaidSumsUntil({ account_ids: ['acc-1'], to: '2026-11-30' });

    expect(result).toEqual([{ account_id: 'acc-1', amount: 200, date: '2026-11-20' }]);
    const query = spies.queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('"paid" = false');
    expect(query.sql).toContain('"date" <=');
  });

  it('SHOULD not query WHEN there are no accounts', async () => {
    expect(await setup.findUnpaidSumsUntil({ account_ids: [], to: '2026-11-30' })).toEqual([]);
    expect(spies.queryRaw).not.toHaveBeenCalled();
  });
});
