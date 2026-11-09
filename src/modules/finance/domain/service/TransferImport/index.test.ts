import { SYSTEM_CATEGORY_IDS } from '@finance/domain/entity/SystemCategory';
import { SystemCategoryKey } from '@finance/domain/enum';

import { groupTransferRows, transferRowKind } from './index';

const OUT = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_OUT];
const IN = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_IN];
const FEE = SYSTEM_CATEGORY_IDS[SystemCategoryKey.TRANSFER_FEE];

function row(overrides: Record<string, unknown>) {
  return {
    accountId: 'acc-a',
    categoryId: OUT,
    currency: 'BRL',
    date: '2026-11-04',
    description: 'Send',
    line: 2,
    notes: null,
    paid: true,
    transferId: 't1',
    value: 100000,
    ...overrides,
  } as Parameters<typeof groupTransferRows>[0][number];
}

describe('transferRowKind', () => {
  it('SHOULD name the three transfer categories AND ignore the others', () => {
    expect(transferRowKind(OUT)).toBe('OUT');
    expect(transferRowKind(IN)).toBe('IN');
    expect(transferRowKind(FEE)).toBe('FEE');
    expect(transferRowKind(SYSTEM_CATEGORY_IDS[SystemCategoryKey.CARD_REFUND])).toBeUndefined();
  });
});

describe('groupTransferRows', () => {
  const out = row({});
  const incoming = row({ accountId: 'acc-b', categoryId: IN, line: 3 });

  it('SHOULD build one transfer from an out and an in row of the same id, with the optional fee', () => {
    const fee = row({ accountId: 'acc-b', categoryId: FEE, line: 4, value: 350 });
    const { errors, groups } = groupTransferRows([out, incoming, fee]);

    expect(errors).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ fee: 350, in: incoming, line: 2, out, paid: true });
  });

  it('SHOULD keep different transfer ids apart', () => {
    const { groups } = groupTransferRows([
      out,
      incoming,
      row({ line: 5, transferId: 't2' }),
      row({ accountId: 'acc-b', categoryId: IN, line: 6, transferId: 't2' }),
    ]);

    expect(groups.map((group) => group.line)).toEqual([2, 5]);
  });

  it.each([
    ['a row without Transfer ID', [row({ transferId: undefined })]],
    ['only the out row', [out]],
    ['only the in row', [incoming]],
    ['two out rows', [out, row({ line: 9 }), incoming]],
    [
      'a fee on another account',
      [out, incoming, row({ accountId: 'acc-c', categoryId: FEE, line: 4 })],
    ],
    [
      'two fee rows',
      [
        out,
        incoming,
        row({ accountId: 'acc-b', categoryId: FEE, line: 4 }),
        row({ accountId: 'acc-b', categoryId: FEE, line: 5 }),
      ],
    ],
  ])('SHOULD report TRANSFER_INCOMPLETE for %s', (_label, rows) => {
    const { errors, groups } = groupTransferRows(rows);

    expect(groups).toEqual([]);
    expect(errors.map((error) => error.code)).toContain('TRANSFER_INCOMPLETE');
  });

  it('SHOULD report TRANSFER_SAME_ACCOUNT, TRANSFER_AMOUNT_MISMATCH and TRANSFER_DATE_IN_BEFORE_OUT', () => {
    expect(groupTransferRows([out, { ...incoming, accountId: 'acc-a' }]).errors[0].code).toBe(
      'TRANSFER_SAME_ACCOUNT',
    );
    expect(groupTransferRows([out, { ...incoming, value: 90000 }]).errors[0].code).toBe(
      'TRANSFER_AMOUNT_MISMATCH',
    );
    expect(groupTransferRows([out, { ...incoming, date: '2026-11-03' }]).errors[0].code).toBe(
      'TRANSFER_DATE_IN_BEFORE_OUT',
    );
  });

  it('SHOULD accept different amounts WHEN the currencies differ', () => {
    const { errors, groups } = groupTransferRows([
      out,
      { ...incoming, currency: 'USD', value: 20000 },
    ]);

    expect(errors).toEqual([]);
    expect(groups).toHaveLength(1);
  });

  it('SHOULD attach the error to the line of the row that causes it', () => {
    const { errors } = groupTransferRows([out, { ...incoming, date: '2026-11-03' }]);

    expect(errors[0].line).toBe(3);
  });
});
