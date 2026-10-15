import { InvoiceStatus } from '@finance/domain/enum';

import { calculateInvoices, effectiveDay } from './index';
import { mocks } from './index.mocks';

const { buildCard } = mocks;

describe('effectiveDay', () => {
  it.each([
    [31, 2026, 2, 28],
    [31, 2028, 2, 29],
    [31, 2026, 4, 30],
    [30, 2026, 2, 28],
    [31, 2026, 1, 31],
    [15, 2026, 2, 15],
  ])('SHOULD resolve day %i of %i-%i to %i', (day, year, month, expected) => {
    expect(effectiveDay(day, year, month)).toBe(expected);
  });
});

describe('closing date and period', () => {
  it('SHOULD clamp closing day 31 to the 28th in February', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 31 }), [], '2026-02-10');

    expect(openInvoice.closingDate).toBe('2026-02-28');
    expect(openInvoice.periodStart).toBe('2026-02-01');
    expect(openInvoice.periodEnd).toBe('2026-02-28');
    expect(openInvoice.referenceMonth).toBe('2026-02');
  });

  it('SHOULD clamp closing day 31 to the 29th in a leap February', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 31 }), [], '2028-02-10');

    expect(openInvoice.closingDate).toBe('2028-02-29');
    expect(openInvoice.periodStart).toBe('2028-02-01');
  });

  it('SHOULD clamp closing day 31 to the 30th in April AND closing day 30 to the 28th in February', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 31 }), [], '2026-04-10').openInvoice,
    ).toMatchObject({
      closingDate: '2026-04-30',
      periodStart: '2026-04-01',
    });
    expect(
      calculateInvoices(buildCard({ closingDay: 30 }), [], '2026-02-10').openInvoice.closingDate,
    ).toBe('2026-02-28');
  });

  it('SHOULD start the period the day after the previous closing date', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], '2026-10-05');

    expect(openInvoice.periodStart).toBe('2026-09-11');
    expect(openInvoice.closingDate).toBe('2026-10-10');
  });

  it('SHOULD roll the reference month over to January WHEN today is after December closing', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], '2026-12-20');

    expect(openInvoice.referenceMonth).toBe('2027-01');
    expect(openInvoice.periodStart).toBe('2026-12-11');
    expect(openInvoice.closingDate).toBe('2027-01-10');
  });
});

describe('due and payment dates', () => {
  it('SHOULD put the due date in the next month WHEN dueDay <= closingDay', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 5 }), [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-11-05');
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 10 }), [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-11-10');
  });

  it('SHOULD put the due date in the reference month WHEN dueDay > closingDay', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 20 }), [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-10-20');
  });

  it('SHOULD roll the due date into January of the next year', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 5 }), [], '2026-12-05').openInvoice
        .dueDate,
    ).toBe('2027-01-05');
  });

  it('SHOULD clamp the due day to the last day of the month (closing 31, due 31 in a 30-day month)', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 31, dueDay: 31 }), [], '2026-03-10').openInvoice
        .dueDate,
    ).toBe('2026-04-30');
  });

  it('SHOULD use the due day as payment day WHEN paymentDay is empty', () => {
    const { openInvoice } = calculateInvoices(
      buildCard({ closingDay: 10, dueDay: 5, paymentDay: undefined }),
      [],
      '2026-10-05',
    );

    expect(openInvoice.paymentDate).toBe(openInvoice.dueDate);
    expect(openInvoice.paymentAfterDue).toBe(false);
  });

  it('SHOULD flag paymentAfterDue WHEN the payment date is after the due date', () => {
    const { openInvoice } = calculateInvoices(
      buildCard({ closingDay: 5, dueDay: 15, paymentDay: 20 }),
      [],
      '2026-10-03',
    );

    expect(openInvoice.dueDate).toBe('2026-10-15');
    expect(openInvoice.paymentDate).toBe('2026-10-20');
    expect(openInvoice.paymentAfterDue).toBe(true);
  });

  it('SHOULD match the spec worked example (closing 31, due 10, payment 5, Feb/2026)', () => {
    const { openInvoice } = calculateInvoices(
      buildCard({ closingDay: 31, dueDay: 10, paymentDay: 5 }),
      [],
      '2026-02-10',
    );

    expect(openInvoice).toMatchObject({
      closingDate: '2026-02-28',
      dueDate: '2026-03-10',
      paymentAfterDue: false,
      paymentDate: '2026-03-05',
    });
  });
});

describe('status', () => {
  it('SHOULD be OPEN on the closing day', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], '2026-10-10');

    expect(openInvoice.referenceMonth).toBe('2026-10');
    expect(openInvoice.status).toBe(InvoiceStatus.OPEN);
  });

  it('SHOULD close the invoice the day after the closing day AND open the next one', () => {
    const { closedInvoices, openInvoice } = calculateInvoices(
      buildCard({ closingDay: 10, createdAt: new Date('2026-01-01T12:00:00.000Z') }),
      [],
      '2026-10-11',
    );

    expect(openInvoice.referenceMonth).toBe('2026-11');
    expect(openInvoice.status).toBe(InvoiceStatus.OPEN);
    expect(closedInvoices[0]).toMatchObject({
      referenceMonth: '2026-10',
      status: InvoiceStatus.CLOSED,
    });
  });
});

describe('amounts, used and available', () => {
  const card = buildCard({
    closingDay: 10,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    limit: 1000,
  });
  const purchases = [
    { amount: 100, date: '2026-08-20' },
    { amount: 200, date: '2026-09-20' },
    { amount: 50, date: '2026-10-10' },
    { amount: 400, date: '2026-10-12' },
  ];

  it('SHOULD sum purchases into the right invoices (closing day stays, next day moves on)', () => {
    const { closedInvoices, openInvoice } = calculateInvoices(card, purchases, '2026-10-15');

    expect(openInvoice).toMatchObject({ amount: 400, referenceMonth: '2026-11' });
    expect(closedInvoices.map((invoice) => [invoice.referenceMonth, invoice.amount])).toEqual([
      ['2026-10', 250],
      ['2026-09', 100],
      ['2026-08', 0],
    ]);
  });

  it('SHOULD compute used as open + closed AND available as limit - used', () => {
    const result = calculateInvoices(card, purchases, '2026-10-15');

    expect(result.used).toBe(750);
    expect(result.available).toBe(250);
  });

  it('SHOULD return a negative available WHEN used exceeds the limit', () => {
    const result = calculateInvoices({ ...card, limit: 500 }, purchases, '2026-10-15');

    expect(result.available).toBe(-250);
  });

  it('SHOULD ignore purchases outside every returned period', () => {
    const result = calculateInvoices(card, [{ amount: 999, date: '2025-01-01' }], '2026-10-15');

    expect(result.used).toBe(0);
  });
});

describe('closed invoices window', () => {
  it('SHOULD return at most 3 closed invoices, newest first', () => {
    const { closedInvoices } = calculateInvoices(
      buildCard({ closingDay: 10, createdAt: new Date('2025-01-01T12:00:00.000Z') }),
      [],
      '2026-10-15',
    );

    expect(closedInvoices.map((invoice) => invoice.referenceMonth)).toEqual([
      '2026-10',
      '2026-09',
      '2026-08',
    ]);
  });

  it('SHOULD NOT return invoices before the card creation month', () => {
    const { closedInvoices } = calculateInvoices(
      buildCard({ closingDay: 10, createdAt: new Date('2026-10-01T12:00:00.000Z') }),
      [],
      '2026-10-15',
    );

    expect(closedInvoices.map((invoice) => invoice.referenceMonth)).toEqual(['2026-10']);
  });

  it('SHOULD return no closed invoices WHEN the card was created in the open reference month', () => {
    const { closedInvoices } = calculateInvoices(
      buildCard({ closingDay: 31, createdAt: new Date('2026-10-14T12:00:00.000Z') }),
      [],
      '2026-10-15',
    );

    expect(closedInvoices).toEqual([]);
  });
});
