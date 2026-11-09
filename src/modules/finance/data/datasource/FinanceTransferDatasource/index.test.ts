import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';

import { mocks, setup, spies } from './index.mocks';

const OUT = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT];
const IN = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN];
const FEE = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE];

function createdRow(args: { data: { account_id: string; paid: boolean; type: string; value: number } }) {
  return Promise.resolve({ ...args.data, id: 'row' });
}

describe('Method create', () => {
  beforeEach(() => {
    spies.transferCreate.mockResolvedValue({ id: 'transfer-1' });
    spies.transactionCreate.mockImplementation(createdRow);
  });

  it('SHOULD lock both accounts, write out, in and fee rows AND move both ledgers WHEN paid', async () => {
    expect(await setup.create(mocks.writeParams)).toEqual(mocks.transferRecord);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate).toHaveBeenCalledTimes(3);
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-b',
          category_id: OUT,
          currency: 'BRL',
          owner: 'USER',
          paid: true,
          transfer_id: 'transfer-1',
          type: 'EXPENSE',
          value: 500000,
        }),
      }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-a',
          category_id: IN,
          date: mocks.writeParams.date_in,
          owner: 'FAMILY',
          type: 'INCOME',
          value: 92000,
        }),
      }),
    );
    expect(spies.transactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          account_id: 'acc-a',
          category_id: FEE,
          date: mocks.writeParams.date_in,
          type: 'EXPENSE',
          value: 350,
        }),
      }),
    );
    // acc-a: +92000 - 350, acc-b: -500000, applied in ascending account id order.
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: 91650 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: -500000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD leave the ledgers alone WHEN the transfer is not paid', async () => {
    await setup.create({ ...mocks.writeParams, paid: false });

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD write no in row WHEN the amount in is unknown AND no fee row WHEN there is no fee', async () => {
    await setup.create({ ...mocks.writeParams, amount_in: null, fee: null, paid: false });

    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate.mock.calls[0][0].data.category_id).toBe(OUT);
  });
});

describe('Method update', () => {
  const rows = [
    { account_id: 'acc-b', category_id: OUT, id: 'row-out', paid: true, type: 'EXPENSE', value: 500000 },
    { account_id: 'acc-a', category_id: IN, id: 'row-in', paid: true, type: 'INCOME', value: 92000 },
    { account_id: 'acc-a', category_id: FEE, id: 'row-fee', paid: true, type: 'EXPENSE', value: 350 },
  ];

  beforeEach(() => {
    spies.transferFindUnique
      .mockResolvedValueOnce({ from_account_id: 'acc-b', to_account_id: 'acc-a', transactions: rows });
    spies.transactionUpdate.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...args.data, id: 'row' }),
    );
  });

  it('SHOULD rewrite the rows in place, apply only the net ledger change AND delete the fee row WHEN the fee is removed', async () => {
    await setup.update('transfer-1', { ...mocks.writeParams, amount_out: 400000, fee: null });

    expect(spies.transactionUpdate).toHaveBeenCalledTimes(2);
    expect(spies.transactionDelete).toHaveBeenCalledWith({ where: { id: 'row-fee' } });
    expect(spies.transferUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount_out: 400000, fee: null }), where: { id: 'transfer-1' } }),
    );
    // acc-a regains the fee (+350), acc-b regains 100000.
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: 350 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: 100000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD revert the old accounts AND apply the new ones WHEN the accounts change', async () => {
    await setup.update('transfer-1', {
      ...mocks.writeParams,
      fee: null,
      from: { account_id: 'acc-c', currency: 'BRL', owner: 'USER', owner_id: 'user-1' },
    });

    const touched = spies.accountUpdate.mock.calls.map((call) => call[0].where.id);
    expect(touched).toEqual(['acc-a', 'acc-b', 'acc-c']);
    expect(spies.queryRaw).toHaveBeenCalledTimes(2);
  });

  it('SHOULD create the in row WHEN the amount in becomes known', async () => {
    spies.transferFindUnique.mockReset();
    spies.transferFindUnique.mockResolvedValueOnce({
      from_account_id: 'acc-b',
      to_account_id: 'acc-a',
      transactions: [rows[0]],
    });
    spies.transactionCreate.mockImplementation(createdRow);

    await setup.update('transfer-1', { ...mocks.writeParams, fee: null });

    expect(spies.transactionCreate).toHaveBeenCalledTimes(1);
    expect(spies.transactionCreate.mock.calls[0][0].data.category_id).toBe(IN);
  });

  it('SHOULD throw NotFound WHEN the transfer does not exist', async () => {
    spies.transferFindUnique.mockReset();
    spies.transferFindUnique.mockResolvedValue(null);

    await expect(setup.update('missing', mocks.writeParams)).rejects.toThrow('Transfer not found');
  });
});

describe('Method delete', () => {
  it('SHOULD delete every row, revert the ledgers AND delete the transfer', async () => {
    spies.transferFindUnique.mockResolvedValue({
      from_account_id: 'acc-b',
      to_account_id: 'acc-a',
      transactions: [
        { account_id: 'acc-b', id: 'row-out', paid: true, type: 'EXPENSE', value: 500000 },
        { account_id: 'acc-a', id: 'row-in', paid: true, type: 'INCOME', value: 92000 },
      ],
    });

    await setup.delete('transfer-1');

    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({ where: { transfer_id: 'transfer-1' } });
    expect(spies.transferDelete).toHaveBeenCalledWith({ where: { id: 'transfer-1' } });
    expect(spies.accountUpdate.mock.calls).toEqual([
      [{ data: { ledger_balance: { increment: -92000 } }, where: { id: 'acc-a' } }],
      [{ data: { ledger_balance: { increment: 500000 } }, where: { id: 'acc-b' } }],
    ]);
  });

  it('SHOULD throw NotFound WHEN the transfer does not exist', async () => {
    spies.transferFindUnique.mockResolvedValue(null);

    await expect(setup.delete('missing')).rejects.toThrow('Transfer not found');
  });
});

describe('Method findById', () => {
  it('SHOULD return the transfer with its row ids', async () => {
    spies.transferFindUnique.mockResolvedValue(mocks.transferRecord);

    expect(await setup.findById('transfer-1')).toEqual(mocks.transferRecord);
  });
});
