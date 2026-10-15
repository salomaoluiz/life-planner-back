import { InvoiceStatus } from '@finance/domain/enum';

export interface BillingCard {
  closingDay: number;
  createdAt: Date;
  dueDay: number;
  limit: number;
  paymentDay?: number;
}
export interface CardInvoices {
  available: number;
  closedInvoices: Invoice[];
  openInvoice: Invoice;
  used: number;
}
export interface Invoice {
  amount: number;
  closingDate: string;
  dueDate: string;
  paymentAfterDue: boolean;
  paymentDate: string;
  periodEnd: string;
  periodStart: string;
  referenceMonth: string;
  status: InvoiceStatus;
}
export interface InvoicePurchase {
  amount: number;
  date: string;
}

interface YearMonth {
  month: number; // 1-12
  year: number;
}

const CLOSED_INVOICES_LIMIT = 3;
const MS_PER_DAY = 86_400_000;

// Pure calendar math on `YYYY-MM-DD` strings (no time zones): ISO dates compare correctly as strings.
export function calculateInvoices(
  card: BillingCard,
  purchases: InvoicePurchase[],
  today: string,
): CardInvoices {
  const current: YearMonth = { month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) };
  const openReference = today <= closingDateOf(card, current) ? current : addMonths(current, 1);
  const creation: YearMonth = {
    month: card.createdAt.getUTCMonth() + 1,
    year: card.createdAt.getUTCFullYear(),
  };

  const openInvoice = buildInvoice(card, openReference, purchases, today);
  const closedInvoices: Invoice[] = [];

  for (let offset = 1; offset <= CLOSED_INVOICES_LIMIT; offset += 1) {
    const reference = addMonths(openReference, -offset);

    if (compareMonths(reference, creation) < 0) {
      break;
    }
    closedInvoices.push(buildInvoice(card, reference, purchases, today));
  }

  const used = closedInvoices.reduce((sum, invoice) => sum + invoice.amount, openInvoice.amount);

  return { available: card.limit - used, closedInvoices, openInvoice, used };
}
export function effectiveDay(day: number, year: number, month: number): number {
  return Math.min(day, daysInMonth(year, month));
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
  purchases: InvoicePurchase[],
  today: string,
): Invoice {
  const closingDate = closingDateOf(card, reference);
  const periodStart = addDays(closingDateOf(card, addMonths(reference, -1)), 1);
  const dueDate = billingDate(card.closingDay, card.dueDay, reference);
  const paymentDate = billingDate(card.closingDay, card.paymentDay ?? card.dueDay, reference);
  const amount = purchases
    .filter((purchase) => purchase.date >= periodStart && purchase.date <= closingDate)
    .reduce((sum, purchase) => sum + purchase.amount, 0);

  return {
    amount,
    closingDate,
    dueDate,
    paymentAfterDue: paymentDate > dueDate,
    paymentDate,
    periodEnd: closingDate,
    periodStart,
    referenceMonth: `${pad(reference.year, 4)}-${pad(reference.month, 2)}`,
    status: today <= closingDate ? InvoiceStatus.OPEN : InvoiceStatus.CLOSED,
  };
}
function closingDateOf(card: BillingCard, reference: YearMonth): string {
  return toDate(reference, effectiveDay(card.closingDay, reference.year, reference.month));
}
function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}
function toDate(reference: YearMonth, day: number): string {
  return `${pad(reference.year, 4)}-${pad(reference.month, 2)}-${pad(day, 2)}`;
}
