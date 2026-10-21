import { ImportRowError } from '@finance/application/service/ImportRows';
import { CardInvoiceData } from '@finance/application/use-case/ComputeCardInvoicesUseCase';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { computeImportedInvoices } from '@finance/domain/service/ImportInvoiceMath';
import { ImportRowKind } from '@finance/domain/service/ImportRowKind';

// A card row of the import, with the invoice it lands on already resolved (spec 048 FR 8).
export interface CardRowItem {
  card: CreditCardEntity;
  date: string;
  invoiceMonth: string;
  kind: ImportRowKind;
  line: number;
  value: number;
}
export interface EvaluatedCardRows {
  // Payments that repeat the payment record the card already has (same invoice and amount).
  duplicateLines: number[];
  errors: ImportRowError[];
  invoices: ImportInvoiceSummary[];
}
export interface ImportInvoiceSummary {
  amountDue: number;
  creditCardId: string;
  invoiceMonth: string;
  paid: boolean;
}

// Spec 048 FR 14-17: the checks that need the whole file. The invoice of every card is computed with the rows of
// the file applied (existing rows + purchases − credits), never row by row; rows already flagged as duplicates
// are not written, so they stay out of the math.
export function evaluateCardRows(input: {
  data: CardInvoiceData[];
  duplicateLines: Set<number>;
  items: CardRowItem[];
  today: string;
}): EvaluatedCardRows {
  const errors: ImportRowError[] = [];
  const duplicateLines: number[] = [];
  const invoices: ImportInvoiceSummary[] = [];

  for (const data of input.data) {
    const items = input.items.filter(
      (item) => item.card.id === data.card.id && !input.duplicateLines.has(item.line),
    );

    if (items.length === 0) {
      continue;
    }

    const deltas = new Map<string, { earlyPaid: number; invoiceMonth: string; net: number }>();

    for (const item of items) {
      const delta = deltas.get(item.invoiceMonth) ?? {
        earlyPaid: 0,
        invoiceMonth: item.invoiceMonth,
        net: 0,
      };

      delta.net += netOf(item);
      delta.earlyPaid += item.kind === 'EARLY_PAYMENT' ? item.value : 0;
      deltas.set(item.invoiceMonth, delta);
    }

    const computed = new Map(
      computeImportedInvoices({
        card: data.card,
        deltas: [...deltas.values()],
        existingTotals: data.totals,
        payments: data.payments,
        today: input.today,
      }).map((invoice) => [invoice.invoiceMonth, invoice]),
    );
    const paidInDb = new Map(data.payments.map((payment) => [payment.referenceMonth, payment]));
    const payments = items.filter((item) => item.kind === 'INVOICE_PAYMENT');
    const paidByFile = new Set<string>();

    for (const item of items) {
      const invoice = computed.get(item.invoiceMonth);
      const stored = paidInDb.get(item.invoiceMonth);

      if (!invoice) {
        continue;
      }

      if (
        item.kind === 'REFUND' ||
        item.kind === 'PREPAYMENT_DISCOUNT' ||
        item.kind === 'EARLY_PAYMENT'
      ) {
        if (stored) {
          errors.push(error(item, 'INVOICE_PAID', `Invoice ${item.invoiceMonth} is already paid`));
        } else if (item.kind === 'EARLY_PAYMENT' && invoice.earlyOver > 0) {
          errors.push(
            error(item, 'EARLY_PAYMENT_OVER_DUE', 'Early payments exceed what is due', {
              month: item.invoiceMonth,
              value: invoice.earlyOver,
            }),
          );
        }
      }

      if (item.kind !== 'INVOICE_PAYMENT') {
        continue;
      }

      if (stored) {
        if (stored.amount === item.value) {
          duplicateLines.push(item.line);
        } else {
          errors.push(
            error(item, 'INVOICE_ALREADY_PAID', `Invoice ${item.invoiceMonth} is already paid`),
          );
        }
      } else if (payments.filter((other) => other.invoiceMonth === item.invoiceMonth).length > 1) {
        errors.push(
          error(
            item,
            'DUPLICATE_INVOICE_PAYMENT',
            `Invoice ${item.invoiceMonth} has more than one payment`,
          ),
        );
      } else if (item.date <= invoice.closingDate) {
        errors.push(
          error(item, 'INVOICE_NOT_CLOSED', `Invoice ${item.invoiceMonth} is still open`, {
            month: item.invoiceMonth,
          }),
        );
      } else if (item.value !== invoice.amountDue) {
        errors.push(
          error(item, 'INVOICE_PAYMENT_MISMATCH', 'The payment does not match the invoice', {
            due: invoice.amountDue,
            month: item.invoiceMonth,
            value: item.value,
          }),
        );
      } else {
        paidByFile.add(item.invoiceMonth);
      }
    }

    for (const invoice of computed.values()) {
      invoices.push({
        amountDue: invoice.amountDue,
        creditCardId: data.card.id,
        invoiceMonth: invoice.invoiceMonth,
        paid: paidInDb.has(invoice.invoiceMonth) || paidByFile.has(invoice.invoiceMonth),
      });
    }
  }

  return { duplicateLines, errors, invoices };
}

function error(
  item: CardRowItem,
  code: ImportRowError['code'],
  message: string,
  params?: ImportRowError['params'],
): ImportRowError {
  return { code, line: item.line, message, params };
}

// What a row adds to the net of its invoice: purchases up, every credit down, payments nothing.
function netOf(item: CardRowItem): number {
  switch (item.kind) {
    case 'CARD_PURCHASE':
      return item.value;
    case 'EARLY_PAYMENT':
    case 'PREPAYMENT_DISCOUNT':
    case 'REFUND':
      return -item.value;
    default:
      return 0;
  }
}
