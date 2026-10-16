import { InvoicePaymentMethod, InvoiceStatus } from '@finance/domain/enum';

export interface BillingCard {
  closingDay: number;
  createdAt: Date;
  dueDay: number;
  limit: number;
  paymentDay?: number;
}
export interface CardInvoices {
  available: number;
  // Every unpaid closed invoice (amount > 0, oldest first), then the paid ones of the last 3 months.
  closedInvoices: Invoice[];
  openInvoice: Invoice;
  // Invoices after the open one that already have purchases, nearest first.
  upcomingInvoices: Invoice[];
  used: number;
}
export interface Invoice {
  amount: number;
  closingDate: string;
  dueDate: string;
  // Day the invoice appears in the transactions list: the real `paidOn` once paid, else the planned `paymentDate`.
  listDate: string;
  payment: InvoicePaymentInfo | null;
  paymentAfterDue: boolean;
  paymentDate: string;
  periodEnd: string;
  periodStart: string;
  referenceMonth: string;
  status: InvoiceStatus;
}
export interface InvoicePaymentInfo {
  accountId: null | string;
  accountName: null | string;
  amount: number;
  method: InvoicePaymentMethod;
  paidOn: string;
  referenceMonth: string;
}
// Sum of the purchases stored on one invoice (`invoiceMonth` is `YYYY-MM`).
export interface InvoiceTotal {
  amount: number;
  invoiceMonth: string;
}

interface YearMonth {
  month: number; // 1-12
  year: number;
}

const CLOSED_PAID_WINDOW = 3;
const MS_PER_DAY = 86_400_000;

export function addInvoiceMonths(month: string, delta: number): string {
  return formatMonth(addMonths(parseMonth(month), delta));
}
// Pure calendar math on `YYYY-MM-DD` strings (no time zones): ISO dates compare correctly as strings.
export function buildInvoiceFor(
  card: BillingCard,
  referenceMonth: string,
  totals: InvoiceTotal[],
  payments: InvoicePaymentInfo[],
  today: string,
): Invoice {
  const amount = totals.find((total) => total.invoiceMonth === referenceMonth)?.amount ?? 0;
  const payment = payments.find((item) => item.referenceMonth === referenceMonth) ?? null;

  return buildInvoice(card, parseMonth(referenceMonth), amount, payment, today);
}
export function calculateInvoices(
  card: BillingCard,
  totals: InvoiceTotal[],
  payments: InvoicePaymentInfo[],
  today: string,
): CardInvoices {
  const current: YearMonth = { month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) };
  const openReference =
    today <= closingDateOf(card.closingDay, current) ? current : addMonths(current, 1);
  const openKey = formatMonth(openReference);
  const paidMonths = new Set(payments.map((payment) => payment.referenceMonth));
  const amountOf = new Map(totals.map((total) => [total.invoiceMonth, total.amount]));

  const unpaidMonths = [...amountOf.entries()]
    .filter(([month, amount]) => amount > 0 && !paidMonths.has(month))
    .map(([month]) => month)
    .sort();
  const used = [...amountOf.entries()]
    .filter(([month]) => !paidMonths.has(month))
    .reduce((sum, [, amount]) => sum + amount, 0);
  function build(month: string): Invoice {
    return buildInvoiceFor(card, month, totals, payments, today);
  }

  const closedUnpaid = unpaidMonths.filter((month) => month < openKey).map(build);
  const recentPaid = payments
    .map((payment) => payment.referenceMonth)
    .filter(
      (month) =>
        month < openKey && month >= formatMonth(addMonths(openReference, -CLOSED_PAID_WINDOW)),
    )
    .sort()
    .map(build);

  return {
    available: card.limit - used,
    closedInvoices: [...closedUnpaid, ...recentPaid],
    openInvoice: build(openKey),
    upcomingInvoices: unpaidMonths.filter((month) => month > openKey).map(build),
    used,
  };
}
export function effectiveDay(day: number, year: number, month: number): number {
  return Math.min(day, daysInMonth(year, month));
}
// The invoice a purchase dated `date` lands on: on the closing day it is still that invoice, the day after it is the next one.
export function invoiceMonthOf(date: string, closingDay: number): string {
  const current: YearMonth = { month: Number(date.slice(5, 7)), year: Number(date.slice(0, 4)) };

  return formatMonth(date <= closingDateOf(closingDay, current) ? current : addMonths(current, 1));
}

function addDays(date: string, delta: number): string {
  const next = new Date(Date.parse(`${date}T00:00:00.000Z`) + delta * MS_PER_DAY);

  return next.toISOString().slice(0, 10);
}
function addMonths(reference: YearMonth, delta: number): YearMonth {
  const index = reference.year * 12 + (reference.month - 1) + delta;

  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

// FR 16/17: the day is in the reference month when it is after the closing day, otherwise in the next one.
function billingDate(closingDay: number, day: number, reference: YearMonth): string {
  const target = day > closingDay ? reference : addMonths(reference, 1);

  return toDate(target, effectiveDay(day, target.year, target.month));
}
function buildInvoice(
  card: BillingCard,
  reference: YearMonth,
  rawAmount: number,
  payment: InvoicePaymentInfo | null,
  today: string,
): Invoice {
  const closingDate = closingDateOf(card.closingDay, reference);
  const periodStart = addDays(closingDateOf(card.closingDay, addMonths(reference, -1)), 1);
  const dueDate = billingDate(card.closingDay, card.dueDay, reference);
  const paymentDate = billingDate(card.closingDay, card.paymentDay ?? card.dueDay, reference);
  const closed = today > closingDate;
  // A paid invoice keeps the amount frozen on its payment; a closed one with nothing to pay counts as paid.
  const paid = payment !== null || (closed && rawAmount === 0);

  return {
    amount: payment ? payment.amount : rawAmount,
    closingDate,
    dueDate,
    listDate: payment ? payment.paidOn : paymentDate,
    payment,
    paymentAfterDue: paymentDate > dueDate,
    paymentDate,
    periodEnd: closingDate,
    periodStart,
    referenceMonth: formatMonth(reference),
    status: statusOf(paid, closed),
  };
}
function closingDateOf(closingDay: number, reference: YearMonth): string {
  return toDate(reference, effectiveDay(closingDay, reference.year, reference.month));
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function formatMonth(reference: YearMonth): string {
  return `${pad(reference.year, 4)}-${pad(reference.month, 2)}`;
}
function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}
function parseMonth(month: string): YearMonth {
  return { month: Number(month.slice(5, 7)), year: Number(month.slice(0, 4)) };
}
function statusOf(paid: boolean, closed: boolean): InvoiceStatus {
  if (paid) {
    return InvoiceStatus.PAID;
  }

  return closed ? InvoiceStatus.CLOSED : InvoiceStatus.OPEN;
}
function toDate(reference: YearMonth, day: number): string {
  return `${pad(reference.year, 4)}-${pad(reference.month, 2)}-${pad(day, 2)}`;
}
