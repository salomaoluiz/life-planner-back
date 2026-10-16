import { InvoicePaymentMethod, InvoiceStatus } from '@finance/domain/enum';

import {
  buildInvoiceFor,
  calculateInvoices,
  effectiveDay,
  invoiceMonthOf,
  InvoicePaymentInfo,
  isInvoiceAssignable,
} from './index';
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
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 31 }), [], [], '2026-02-10');

    expect(openInvoice.closingDate).toBe('2026-02-28');
    expect(openInvoice.periodStart).toBe('2026-02-01');
    expect(openInvoice.periodEnd).toBe('2026-02-28');
    expect(openInvoice.referenceMonth).toBe('2026-02');
  });

  it('SHOULD clamp closing day 31 to the 29th in a leap February', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 31 }), [], [], '2028-02-10');

    expect(openInvoice.closingDate).toBe('2028-02-29');
    expect(openInvoice.periodStart).toBe('2028-02-01');
  });

  it('SHOULD clamp closing day 31 to the 30th in April AND closing day 30 to the 28th in February', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 31 }), [], [], '2026-04-10').openInvoice,
    ).toMatchObject({
      closingDate: '2026-04-30',
      periodStart: '2026-04-01',
    });
    expect(
      calculateInvoices(buildCard({ closingDay: 30 }), [], [], '2026-02-10').openInvoice
        .closingDate,
    ).toBe('2026-02-28');
  });

  it('SHOULD start the period the day after the previous closing date', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], [], '2026-10-05');

    expect(openInvoice.periodStart).toBe('2026-09-11');
    expect(openInvoice.closingDate).toBe('2026-10-10');
  });

  it('SHOULD roll the reference month over to January WHEN today is after December closing', () => {
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], [], '2026-12-20');

    expect(openInvoice.referenceMonth).toBe('2027-01');
    expect(openInvoice.periodStart).toBe('2026-12-11');
    expect(openInvoice.closingDate).toBe('2027-01-10');
  });
});

describe('due and payment dates', () => {
  it('SHOULD put the due date in the next month WHEN dueDay <= closingDay', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 5 }), [], [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-11-05');
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 10 }), [], [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-11-10');
  });

  it('SHOULD put the due date in the reference month WHEN dueDay > closingDay', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 20 }), [], [], '2026-10-05').openInvoice
        .dueDate,
    ).toBe('2026-10-20');
  });

  it('SHOULD roll the due date into January of the next year', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 10, dueDay: 5 }), [], [], '2026-12-05').openInvoice
        .dueDate,
    ).toBe('2027-01-05');
  });

  it('SHOULD clamp the due day to the last day of the month (closing 31, due 31 in a 30-day month)', () => {
    expect(
      calculateInvoices(buildCard({ closingDay: 31, dueDay: 31 }), [], [], '2026-03-10').openInvoice
        .dueDate,
    ).toBe('2026-04-30');
  });

  it('SHOULD use the due day as payment day WHEN paymentDay is empty', () => {
    const { openInvoice } = calculateInvoices(
      buildCard({ closingDay: 10, dueDay: 5, paymentDay: undefined }),
      [],
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
    const { openInvoice } = calculateInvoices(buildCard({ closingDay: 10 }), [], [], '2026-10-10');

    expect(openInvoice.referenceMonth).toBe('2026-10');
    expect(openInvoice.status).toBe(InvoiceStatus.OPEN);
  });

  it('SHOULD close the invoice the day after the closing day AND open the next one', () => {
    const { closedInvoices, openInvoice } = calculateInvoices(
      buildCard({ closingDay: 10 }),
      [{ amount: 100, invoiceMonth: '2026-10' }],
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

describe('invoiceMonthOf', () => {
  it.each([
    ['2026-10-31', 31, '2026-10'],
    ['2026-11-01', 31, '2026-11'],
    ['2026-10-10', 10, '2026-10'],
    ['2026-10-11', 10, '2026-11'],
    ['2026-02-28', 30, '2026-02'],
    ['2026-04-30', 31, '2026-04'],
    ['2026-12-31', 31, '2026-12'],
    ['2026-12-31', 15, '2027-01'],
    ['2026-12-16', 15, '2027-01'],
    ['2026-12-15', 15, '2026-12'],
  ])('SHOULD put %s with closing day %i on invoice %s', (date, closingDay, expected) => {
    expect(invoiceMonthOf(date, closingDay)).toBe(expected);
  });
});

describe('amounts, used and available (spec 029)', () => {
  const card = buildCard({ closingDay: 31, dueDay: 10, limit: 100000, paymentDay: 5 });
  const totals = [
    { amount: 2000, invoiceMonth: '2026-09' },
    { amount: 45000, invoiceMonth: '2026-10' },
    { amount: 1000, invoiceMonth: '2026-11' },
    { amount: 3000, invoiceMonth: '2026-12' },
  ];

  it('SHOULD split unpaid closed, open and upcoming AND count every unpaid invoice in used', () => {
    const result = calculateInvoices(card, totals, [], '2026-10-15');

    expect(result.openInvoice).toMatchObject({ amount: 45000, referenceMonth: '2026-10' });
    expect(result.closedInvoices.map((invoice) => invoice.referenceMonth)).toEqual(['2026-09']);
    expect(result.closedInvoices[0].status).toBe(InvoiceStatus.CLOSED);
    expect(result.upcomingInvoices.map((invoice) => invoice.referenceMonth)).toEqual([
      '2026-11',
      '2026-12',
    ]);
    expect(result.used).toBe(51000);
    expect(result.available).toBe(49000);
  });

  it('SHOULD return a negative available WHEN used exceeds the limit', () => {
    expect(calculateInvoices({ ...card, limit: 1000 }, totals, [], '2026-10-15').available).toBe(
      -50000,
    );
  });

  it('SHOULD drop a paid invoice from used AND list it after the unpaid ones, with the frozen amount', () => {
    const payment: InvoicePaymentInfo = {
      accountId: 'acc-1',
      accountName: 'Bank',
      amount: 2000,
      method: InvoicePaymentMethod.ACCOUNT,
      paidOn: '2026-10-05',
      referenceMonth: '2026-09',
    };
    const result = calculateInvoices(card, totals, [payment], '2026-10-15');

    expect(result.used).toBe(49000);
    expect(result.closedInvoices).toHaveLength(1);
    expect(result.closedInvoices[0]).toMatchObject({
      amount: 2000,
      listDate: '2026-10-05',
      payment,
      status: InvoiceStatus.PAID,
    });
  });

  it('SHOULD NOT list a closed invoice with amount 0 AND treat it as PAID', () => {
    const result = calculateInvoices(
      card,
      [{ amount: 0, invoiceMonth: '2026-09' }],
      [],
      '2026-10-15',
    );

    expect(result.closedInvoices).toEqual([]);
    expect(buildInvoiceFor(card, '2026-09', [], [], '2026-10-15').status).toBe(InvoiceStatus.PAID);
  });

  it('SHOULD use the planned payment date as list date WHILE unpaid', () => {
    expect(buildInvoiceFor(card, '2026-10', totals, [], '2026-10-15').listDate).toBe('2026-11-05');
  });

  it('SHOULD put paid invoices older than 3 months out of the list', () => {
    const payment: InvoicePaymentInfo = {
      accountId: null,
      accountName: null,
      amount: 10,
      method: InvoicePaymentMethod.EXTERNAL,
      paidOn: '2026-05-05',
      referenceMonth: '2026-04',
    };

    expect(calculateInvoices(card, [], [payment], '2026-10-15').closedInvoices).toEqual([]);
  });
});

describe('credits and carry chain (spec 032)', () => {
  const card = buildCard({ closingDay: 10 });
  const today = '2026-11-20';
  function paid(referenceMonth: string): InvoicePaymentInfo {
    return {
      accountId: null,
      accountName: null,
      amount: 100,
      method: InvoicePaymentMethod.EXTERNAL,
      paidOn: '2026-10-25',
      referenceMonth,
    };
  }

  it('SHOULD carry a negative invoice into the next one AND treat the negative closed one as paid', () => {
    const totals = [
      { amount: -200, invoiceMonth: '2026-10' },
      { amount: 450, invoiceMonth: '2026-11' },
    ];
    const october = buildInvoiceFor(card, '2026-10', totals, [], today);
    const november = buildInvoiceFor(card, '2026-11', totals, [], today);

    expect(october).toMatchObject({
      amount: 0,
      amountDue: 0,
      status: InvoiceStatus.PAID,
      total: -200,
    });
    expect(november).toMatchObject({ amountDue: 250, carryIn: -200, net: 450, total: 250 });
  });

  it('SHOULD carry twice when a credit is bigger than the next invoice', () => {
    const totals = [
      { amount: -500, invoiceMonth: '2026-09' },
      { amount: 100, invoiceMonth: '2026-10' },
      { amount: 700, invoiceMonth: '2026-11' },
    ];

    expect(buildInvoiceFor(card, '2026-10', totals, [], today)).toMatchObject({
      amountDue: 0,
      total: -400,
    });
    expect(buildInvoiceFor(card, '2026-11', totals, [], today)).toMatchObject({
      amountDue: 300,
      carryIn: -400,
    });
  });

  it('SHOULD carry through a month without rows', () => {
    const totals = [
      { amount: -300, invoiceMonth: '2026-08' },
      { amount: 500, invoiceMonth: '2026-11' },
    ];

    expect(buildInvoiceFor(card, '2026-11', totals, [], today).carryIn).toBe(-300);
  });

  it('SHOULD break the chain at a month with a payment record', () => {
    const totals = [
      { amount: -200, invoiceMonth: '2026-10' },
      { amount: 450, invoiceMonth: '2026-11' },
    ];

    expect(buildInvoiceFor(card, '2026-11', totals, [paid('2026-10')], today).carryIn).toBe(0);
  });

  it('SHOULD keep an OPEN invoice OPEN when its total is negative', () => {
    const invoice = buildInvoiceFor(
      card,
      '2026-12',
      [{ amount: -50, invoiceMonth: '2026-12' }],
      [],
      today,
    );

    expect(invoice).toMatchObject({ amountDue: 0, status: InvoiceStatus.OPEN, total: -50 });
  });

  it('SHOULD sum only the amount due of unpaid invoices into used AND list a settled closed one', () => {
    const totals = [
      { amount: -200, invoiceMonth: '2026-10' },
      { amount: 450, invoiceMonth: '2026-11' },
    ];
    const result = calculateInvoices(card, totals, [], today);

    expect(result.used).toBe(250);
    expect(result.available).toBe(card.limit - 250);
    expect(result.closedInvoices.map((invoice) => invoice.referenceMonth)).toContain('2026-10');
  });

  it('SHOULD return the early paid sum of the invoice', () => {
    const invoice = buildInvoiceFor(
      card,
      '2026-11',
      [{ amount: 400, earlyPaid: 600, invoiceMonth: '2026-11' }],
      [],
      today,
    );

    expect(invoice).toMatchObject({ amountDue: 400, earlyPaid: 600 });
  });

  it('SHOULD accept only the open and closed unpaid invoices as credit targets', () => {
    expect(isInvoiceAssignable(card, '2026-12', [], today)).toBe(true);
    expect(isInvoiceAssignable(card, '2026-10', [], today)).toBe(true);
    expect(isInvoiceAssignable(card, '2027-01', [], today)).toBe(false);
    expect(isInvoiceAssignable(card, '2026-10', [paid('2026-10')], today)).toBe(false);
  });
});
