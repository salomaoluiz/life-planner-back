import {
  addInvoiceMonths,
  BillingCard,
  buildInvoiceFor,
  invoiceMonthOf,
  InvoicePaymentInfo,
  InvoiceTotal,
} from '@finance/domain/service/InvoiceCalculator';

// Spec 048 FR 15-17: what the file adds to one invoice. `net` = purchases minus every credit of the file,
// early payments included; `earlyPaid` = the early payments alone.
export interface ImportedInvoice {
  amountDue: number;
  closingDate: string;
  // How far the early payments of the file pass what was due (0 when within it).
  earlyOver: number;
  invoiceMonth: string;
}
export interface ImportInvoiceDelta {
  earlyPaid: number;
  invoiceMonth: string;
  net: number;
}

export function computeImportedInvoices(input: {
  card: BillingCard;
  deltas: ImportInvoiceDelta[];
  existingTotals: InvoiceTotal[];
  payments: InvoicePaymentInfo[];
  today: string;
}): ImportedInvoice[] {
  const totals = new Map(input.existingTotals.map((total) => [total.invoiceMonth, { ...total }]));

  for (const delta of input.deltas) {
    const current = totals.get(delta.invoiceMonth) ?? {
      amount: 0,
      invoiceMonth: delta.invoiceMonth,
    };

    totals.set(delta.invoiceMonth, {
      ...current,
      amount: current.amount + delta.net,
      earlyPaid: (current.earlyPaid ?? 0) + delta.earlyPaid,
    });
  }

  const merged = [...totals.values()];

  return input.deltas
    .map((delta) => delta.invoiceMonth)
    .filter((month, index, all) => all.indexOf(month) === index)
    .sort()
    .map((month) => {
      const invoice = buildInvoiceFor(input.card, month, merged, input.payments, input.today);
      const early = input.deltas
        .filter((delta) => delta.invoiceMonth === month)
        .reduce((sum, delta) => sum + delta.earlyPaid, 0);

      return {
        amountDue: invoice.amountDue,
        closingDate: invoice.closingDate,
        earlyOver: invoice.total < 0 ? Math.min(early, -invoice.total) : 0,
        invoiceMonth: month,
      };
    });
}

// FR 8: a payment pays the invoice whose due date is the closest on or after its date.
export function defaultPaymentInvoiceMonth(
  date: string,
  card: Pick<BillingCard, 'closingDay' | 'dueDay'>,
): string {
  const billing = { ...card, createdAt: new Date(0), limit: 0 };
  const start = addInvoiceMonths(invoiceMonthOf(date, card.closingDay), -2);

  for (let month = start; ; month = addInvoiceMonths(month, 1)) {
    if (buildInvoiceFor(billing, month, [], [], date).dueDate >= date) {
      return month;
    }
  }
}
