import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { applyTagNames } from '@finance/data/datasource/tags';

import { mocks, setup, spies } from './index.mocks';

jest.mock('@finance/data/datasource/tags', () => ({
  ...jest.requireActual('@finance/data/datasource/tags'),
  applyTagNames: jest.fn(),
}));

function deltasOf() {
  return spies.accountUpdate.mock.calls.map(([call]) => [
    call.where.id,
    call.data.ledger_balance.increment,
  ]);
}

describe('Method create (FR 15)', () => {
  beforeEach(() => {
    spies.transactionCreate.mockImplementation(async ({ data }) =>
      mocks.scalars(`row-${data.split_position}`, data.value),
    );
  });

  it('SHOULD write the header, every part sharing the shared fields AND the ledger once', async () => {
    await setup.create(mocks.writeParams);

    expect(spies.splitCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ description: 'Mercado', notes: 'Compra do mês', paid: true }),
    );
    const parts = spies.transactionCreate.mock.calls.map(([call]) => call.data);

    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual(
      expect.objectContaining({
        created_at: mocks.header.created_at,
        description: 'Mercado',
        description_inherited: true,
        recurrence_id: null,
        split_id: 'split-1',
        split_position: 0,
      }),
    );
    expect(parts[1]).toEqual(
      expect.objectContaining({ description: 'Detergente', description_inherited: false }),
    );
    // 12000 + 5000 - 440 = 16560 expense, applied as ONE increment: the ledger gets -16560.
    expect(deltasOf()).toEqual([['acc-1', -16560]]);
    expect(applyTagNames).toHaveBeenCalledTimes(1);
  });

  it('SHOULD refuse WHEN the invoice of a card split is paid AND write nothing', async () => {
    spies.invoicePaymentFindFirst.mockResolvedValueOnce({ id: 'payment' });

    await expect(
      setup.create({
        ...mocks.writeParams,
        account_id: null,
        credit_card_id: 'card-1',
        invoice_month: '2026-11',
        paid: null,
      }),
    ).rejects.toThrow('Invoice is paid');
    expect(spies.splitCreate).not.toHaveBeenCalled();
  });

  it('SHOULD convert a saved row: it keeps its id as the first part AND the ledger follows the change', async () => {
    spies.transactionFindUnique.mockResolvedValue(mocks.scalars('row-src', 28000));
    spies.transactionUpdate.mockResolvedValue(mocks.scalars('row-src', 12000));

    await setup.create({ ...mocks.writeParams, source_transaction_id: 'row-src' });

    expect(spies.transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ split_position: 0, value: 12000 }),
        where: { id: 'row-src' },
      }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledTimes(2);
    // before -28000, after -12000, +2 created (-5000, +440): net +11000 + 440 ... -16560 total new = -16560 + 28000.
    expect(deltasOf()).toEqual([['acc-1', 28000 - 16560]]);
  });

  it('SHOULD throw NotFound WHEN the row to convert is gone', async () => {
    spies.transactionFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      setup.create({ ...mocks.writeParams, source_transaction_id: 'row-src' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Method createMany (FR 38)', () => {
  it('SHOULD write every split in ONE transaction AND return the count', async () => {
    spies.transactionCreate.mockImplementation(async ({ data }) => mocks.scalars('r', data.value));

    expect(await setup.createMany([mocks.writeParams, mocks.writeParams])).toBe(2);
    expect(spies.splitCreate).toHaveBeenCalledTimes(2);
    expect(await setup.createMany([])).toBe(0);
  });
});

describe('Method update (FR 18, 22)', () => {
  const existing = {
    account_id: 'acc-1',
    created_at: mocks.header.created_at,
    credit_card_id: null,
    invoice_month: null,
    transactions: [mocks.scalars('p1', 12000), mocks.scalars('p2', 5000)],
  };

  beforeEach(() => {
    spies.splitFindUnique.mockResolvedValue(existing);
    spies.splitFindUniqueOrThrow.mockResolvedValue(mocks.splitRecord);
    spies.transactionUpdate.mockImplementation(async ({ data, where }) =>
      mocks.scalars(where.id, data.value ?? 1),
    );
    spies.transactionCreate.mockImplementation(async ({ data }) =>
      mocks.scalars('new', data.value),
    );
    spies.splitFindUnique.mockResolvedValue(existing);
  });

  it('SHOULD update kept parts in place, create new ones AND delete the missing ones', async () => {
    spies.splitFindUnique.mockResolvedValueOnce(existing).mockResolvedValue(mocks.splitRecord);

    const result = await setup.update('split-1', {
      ...mocks.writeParams,
      parts: [
        { ...mocks.writeParams.parts[0], id: 'p1', value: 14000 },
        { category_id: 'cat-9', description: null, type: 'EXPENSE' as never, value: 700 },
      ],
    });

    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'p2' } });
    expect(spies.transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' } }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    // old -17000, new -14700: the ledger moves by +2300.
    expect(deltasOf()).toEqual([['acc-1', 2300]]);
    expect(result.dissolved_id).toBeUndefined();
    expect(result.split).toBeDefined();
  });

  it('SHOULD dissolve WHEN one part is left: the row loses its split AND the header goes', async () => {
    spies.transactionFindMany.mockResolvedValue([{ id: 'p1' }]);

    const result = await setup.update('split-1', {
      ...mocks.writeParams,
      parts: [{ ...mocks.writeParams.parts[0], id: 'p1' }],
    });

    expect(result).toEqual({ dissolved_id: 'p1' });
    expect(spies.transactionUpdate).toHaveBeenLastCalledWith({
      data: { description_inherited: false, split_id: null, split_position: null },
      where: { id: 'p1' },
    });
    expect(spies.splitDelete).toHaveBeenCalledWith({ where: { id: 'split-1' } });
  });

  it('SHOULD refuse a part id that is not of the split (422)', async () => {
    await expect(
      setup.update('split-1', {
        ...mocks.writeParams,
        parts: [{ ...mocks.writeParams.parts[0], id: 'foreign' }, mocks.writeParams.parts[1]],
      }),
    ).rejects.toThrow(new UnprocessableEntityException('Split part not found'));
  });

  it('SHOULD throw NotFound WHEN the split is gone', async () => {
    spies.splitFindUnique.mockResolvedValueOnce(null);

    await expect(setup.update('split-1', mocks.writeParams)).rejects.toThrow(NotFoundException);
  });

  it('SHOULD refuse WHEN the stored invoice is paid', async () => {
    spies.invoicePaymentFindFirst.mockResolvedValueOnce({ id: 'payment' });
    spies.splitFindUnique.mockResolvedValueOnce({
      ...existing,
      account_id: null,
      credit_card_id: 'card-1',
      invoice_month: '2026-10',
    });

    await expect(setup.update('split-1', mocks.writeParams)).rejects.toThrow('Invoice is paid');
  });
});

describe('Method setPaid (FR 19)', () => {
  it('SHOULD flip paid on the header and every part AND move the ledger by the net', async () => {
    spies.splitFindUnique
      .mockResolvedValueOnce({
        account_id: 'acc-1',
        transactions: [
          mocks.scalars('p1', 12000, { paid: false }),
          mocks.scalars('p2', 5000, { paid: false }),
        ],
      })
      .mockResolvedValue(mocks.splitRecord);
    spies.splitFindUnique.mockResolvedValue(mocks.splitRecord);
    spies.splitFindUnique.mockResolvedValueOnce({
      account_id: 'acc-1',
      transactions: [
        mocks.scalars('p1', 12000, { paid: false }),
        mocks.scalars('p2', 5000, { paid: false }),
      ],
    });

    await setup.setPaid('split-1', true);

    expect(spies.transactionUpdateMany).toHaveBeenCalledWith({
      data: { paid: true },
      where: { split_id: 'split-1' },
    });
    expect(spies.splitUpdate).toHaveBeenCalledWith({
      data: { paid: true },
      where: { id: 'split-1' },
    });
    expect(deltasOf()).toEqual([['acc-1', -17000]]);
  });

  it('SHOULD throw NotFound WHEN the split is gone', async () => {
    spies.splitFindUnique.mockResolvedValueOnce(null);

    await expect(setup.setPaid('split-1', true)).rejects.toThrow(NotFoundException);
  });
});

describe('Method delete (FR 20)', () => {
  it('SHOULD delete the parts, give the money back AND remove the header', async () => {
    spies.splitFindUnique.mockResolvedValueOnce({
      account_id: 'acc-1',
      credit_card_id: null,
      invoice_month: null,
      transactions: [mocks.scalars('p1', 12000), mocks.scalars('p2', 5000)],
    });

    await setup.delete('split-1');

    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({ where: { split_id: 'split-1' } });
    expect(deltasOf()).toEqual([['acc-1', 17000]]);
    expect(spies.splitDelete).toHaveBeenCalledWith({ where: { id: 'split-1' } });
  });

  it('SHOULD throw NotFound WHEN the split is gone', async () => {
    spies.splitFindUnique.mockResolvedValueOnce(null);

    await expect(setup.delete('split-1')).rejects.toThrow(NotFoundException);
  });
});

describe('reads', () => {
  it('SHOULD read by id, by ids AND the summaries', async () => {
    spies.splitFindUnique.mockResolvedValueOnce(mocks.splitRecord);
    spies.splitFindMany.mockResolvedValue([mocks.splitRecord]);

    expect(await setup.findById('split-1')).toBe(mocks.splitRecord);
    expect(await setup.findByIds(['split-1'])).toEqual([mocks.splitRecord]);
    expect(await setup.findSummaries(['split-1'])).toEqual([mocks.splitRecord]);
    expect(spies.splitFindMany.mock.calls[0][0].include.transactions.orderBy).toEqual({
      split_position: 'asc',
    });
  });
});
