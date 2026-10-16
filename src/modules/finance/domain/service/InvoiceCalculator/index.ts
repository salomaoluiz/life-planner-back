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
  // What is due: `amountDue`, or the amount frozen on the payment record once paid.
  amount: number;
  amountDue: number;
  carryIn: number;
  closingDate: string;
  dueDate: string;
  earlyPaid: number;
  // Day the invoice appears in the transactions list: the real `paidOn` once paid, else the planned `paymentDate`.
  listDate: string;
  // Purchases minus credits of this invoice month.
  net: number;
  payment: InvoicePaymentInfo | null;
  paymentAfterDue: boolean;
  paymentDate: string;
  periodEnd: string;
  periodStart: string;
  referenceMonth: string;
  status: InvoiceStatus;
  // net + carryIn
  total: number;
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
  // NET: purchases minus credits.
  amount: number;
  earlyPaid?: number;
  invoiceMonth: string;
}

interface ChainEntry {
  carryIn: number;
  net: number;
  total: number;
}
interface YearMonth {
  month: number; // 1-12
  year: number;
}

const CLOSED_PAID_WINDOW = 3;
const EMPTY_ENTRY: ChainEntry = { carryIn: 0, net: 0, total: 0 };
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
  const payment = payments.find((item) => item.referenceMonth === referenceMonth) ?? null;
  const paidMonths = new Set(payments.map((item) => item.referenceMonth));
  const entry = chainOf(totals, paidMonths, referenceMonth).get(referenceMonth) ?? EMPTY_ENTRY;
  const earlyPaid = totals.find((total) => total.invoiceMonth === referenceMonth)?.earlyPaid ?? 0;

  return buildInvoice(card, parseMonth(referenceMonth), entry, earlyPaid, payment, today);
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
  const chain = chainOf(totals, paidMonths, openKey);
  // Months with credits worth showing: a negative total or an early payment.
  const earlyPaidOf = new Map(totals.map((total) => [total.invoiceMonth, total.earlyPaid ?? 0]));

  const unpaidMonths = [...chain.entries()]
    .filter(([month, entry]) => entry.total > 0 && !paidMonths.has(month))
    .map(([month]) => month)
    .sort();
  const used = [...chain.entries()]
    .filter(([month]) => !paidMonths.has(month))
    .reduce((sum, [, entry]) => sum + Math.max(0, entry.total), 0);
  function build(month: string): Invoice {
    return buildInvoiceFor(card, month, totals, payments, today);
  }

  const closedUnpaid = unpaidMonths.filter((month) => month < openKey).map(build);
  const windowStart = formatMonth(addMonths(openReference, -CLOSED_PAID_WINDOW));
  const settledByCredit = [...chain.entries()]
    .filter(
      ([month, entry]) =>
        !paidMonths.has(month) && (entry.total < 0 || (earlyPaidOf.get(month) ?? 0) > 0),
    )
    .map(([month]) => month);
  const recentPaid = [...new Set([...paidMonths, ...settledByCredit])]
    .filter((month) => month < openKey && month >= windowStart)
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

// A credit can go to an invoice that has no payment record and is not an upcoming one (spec 032).
export function isInvoiceAssignable(
  card: BillingCard,
  referenceMonth: string,
  payments: InvoicePaymentInfo[],
  today: string,
): boolean {
  return (
    !payments.some((payment) => payment.referenceMonth === referenceMonth) &&
    referenceMonth <= invoiceMonthOf(today, card.closingDay)
  );
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
  entry: ChainEntry,
  earlyPaid: number,
  payment: InvoicePaymentInfo | null,
  today: string,
): Invoice {
  const closingDate = closingDateOf(card.closingDay, reference);
  const periodStart = addDays(closingDateOf(card.closingDay, addMonths(reference, -1)), 1);
  const dueDate = billingDate(card.closingDay, card.dueDay, reference);
  const paymentDate = billingDate(card.closingDay, card.paymentDay ?? card.dueDay, reference);
  const closed = today > closingDate;
  const amountDue = Math.max(0, entry.total);
  // A paid invoice keeps the amount frozen on its payment; a closed one with nothing to pay counts as paid.
  const paid = payment !== null || (closed && entry.total <= 0);

  return {
    amount: payment ? payment.amount : amountDue,
    amountDue,
    carryIn: entry.carryIn,
    closingDate,
    dueDate,
    earlyPaid,
    listDate: payment ? payment.paidOn : paymentDate,
    net: entry.net,
    payment,
    paymentAfterDue: paymentDate > dueDate,
    paymentDate,
    periodEnd: closingDate,
    periodStart,
    referenceMonth: formatMonth(reference),
    status: statusOf(paid, closed),
    total: entry.total,
  };
}
// Walks the months from the first invoice to `upTo`: a negative total moves to the next month, a payment record ends the chain.
function chainOf(
  totals: InvoiceTotal[],
  paidMonths: Set<string>,
  upTo: string,
): Map<string, ChainEntry> {
  const chain = new Map<string, ChainEntry>();

  if (totals.length === 0) {
    return chain;
  }

  const netOf = new Map(totals.map((total) => [total.invoiceMonth, total.amount]));
  const months = [...netOf.keys()].sort();
  const last = months[months.length - 1];
  const end = upTo > last ? upTo : last;
  let carry = 0;

  for (let month = months[0]; month <= end; month = addInvoiceMonths(month, 1)) {
    const net = netOf.get(month) ?? 0;
    const total = net + carry;

    chain.set(month, { carryIn: carry, net, total });
    carry = paidMonths.has(month) ? 0 : Math.min(0, total);
  }

  return chain;
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
