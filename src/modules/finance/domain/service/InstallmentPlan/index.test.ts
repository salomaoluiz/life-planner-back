import {
  eligibleForPrepayment,
  installmentInvoiceMonths,
  isStructuralChange,
  reassignInstallmentMonths,
  splitInstallments,
} from '@finance/domain/service/InstallmentPlan';

describe('splitInstallments', () => {
  it('puts the remainder on the first installment', () => {
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('splits evenly', () => {
    expect(splitInstallments(512000, 10)).toEqual(Array(10).fill(51200));
  });

  it('keeps the sum equal to the total', () => {
    const result = splitInstallments(100, 48);

    expect(result[0]).toBe(6);
    expect(result.slice(1)).toEqual(Array(47).fill(2));
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it.each([
    [100, 1],
    [100, 49],
    [5, 10],
  ])('rejects total %d in %d installments', (total, count) => {
    expect(() => splitInstallments(total, count)).toThrow(RangeError);
  });
});

describe('installmentInvoiceMonths', () => {
  it('rolls over the year', () => {
    const months = installmentInvoiceMonths('2026-10', 10);

    expect(months[0]).toBe('2026-10');
    expect(months[3]).toBe('2027-01');
    expect(months[9]).toBe('2027-07');
  });
});

describe('reassignInstallmentMonths', () => {
  it('follows first + (k - 1) when all are unpaid', () => {
    const rows = [
      { invoiceMonth: '2026-10', paid: false },
      { invoiceMonth: '2026-11', paid: false },
    ];

    expect(reassignInstallmentMonths(rows, '2026-11', new Set())).toEqual(['2026-11', '2026-12']);
  });

  it('keeps paid rows and moves later ones after them', () => {
    const rows = [
      { invoiceMonth: '2026-10', paid: true },
      { invoiceMonth: '2026-11', paid: false },
      { invoiceMonth: '2026-12', paid: false },
    ];

    expect(reassignInstallmentMonths(rows, '2026-09', new Set(['2026-10']))).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });

  it('skips a month paid by another purchase', () => {
    const rows = [
      { invoiceMonth: '2026-10', paid: false },
      { invoiceMonth: '2026-11', paid: false },
    ];

    expect(reassignInstallmentMonths(rows, '2026-10', new Set(['2026-11']))).toEqual([
      '2026-10',
      '2026-12',
    ]);
  });
});

describe('isStructuralChange', () => {
  const current = { count: 3, creditCardId: 'card', date: '2026-10-20', total: 3000 };

  it('is false when nothing really changes', () => {
    expect(isStructuralChange(current, {})).toBe(false);
    expect(
      isStructuralChange(current, {
        creditCardId: 'card',
        date: '2026-10-20',
        installments: 3,
        value: 3000,
      }),
    ).toBe(false);
  });

  it.each([
    { value: 3100 },
    { installments: 4 },
    { creditCardId: 'other' },
    { date: '2026-10-21' },
  ])('is true for %p', (patch) => {
    expect(isStructuralChange(current, patch)).toBe(true);
  });
});

describe('eligibleForPrepayment', () => {
  const rows = [
    { id: 'tx-4', installmentNumber: 4, invoiceMonth: '2026-10', value: 100 },
    { id: 'tx-5', installmentNumber: 5, invoiceMonth: '2026-11', value: 100 },
    { id: 'tx-6', installmentNumber: 6, invoiceMonth: '2026-12', value: 100 },
  ];

  it('SHOULD return the installments after the target invoice', () => {
    expect(eligibleForPrepayment(rows, '2026-10', new Set()).map((row) => row.id)).toEqual([
      'tx-5',
      'tx-6',
    ]);
  });

  it('SHOULD skip those in a paid invoice AND return [] WHEN none is after the target', () => {
    expect(eligibleForPrepayment(rows, '2026-09', new Set(['2026-11'])).map((r) => r.id)).toEqual([
      'tx-4',
      'tx-6',
    ]);
    expect(eligibleForPrepayment(rows, '2026-12', new Set())).toEqual([]);
  });
});
