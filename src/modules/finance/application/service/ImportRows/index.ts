import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  CalendarDateSchema,
  DescriptionSchema,
  TagNameSchema,
  ValueSchema,
} from '@finance/application/dto/FinanceCommon';
import { ImportRow } from '@finance/application/dto/ImportTransactions';
import { TransactionType } from '@finance/domain/enum';
import { SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';
import { importRowKind, parseInvoiceMonth } from '@finance/domain/service/ImportRowKind';
import { normalizeText } from '@finance/domain/service/TextMatch';

export type ImportErrorCode =
  | 'ACCOUNT_AND_CARD'
  | 'ACCOUNT_ARCHIVED'
  | 'ACCOUNT_NOT_FOUND'
  | 'CARD_CREDIT_CATEGORY_MISUSED'
  | 'CARD_INCOME_CATEGORY'
  | 'CARD_NOT_FOUND'
  | 'CATEGORY_ARCHIVED'
  | 'CATEGORY_NOT_FOUND'
  | 'CURRENCY_MISMATCH'
  | 'DESCRIPTION_INVALID'
  | 'DUPLICATE_INVOICE_PAYMENT'
  | 'EARLY_PAYMENT_OVER_DUE'
  | 'INVALID_DATE'
  | 'INVALID_VALUE'
  | 'INVOICE_ALREADY_PAID'
  | 'INVOICE_MONTH_INVALID'
  | 'INVOICE_NOT_CLOSED'
  | 'INVOICE_PAID'
  | 'INVOICE_PAYMENT_MISMATCH'
  | 'OWNER_ARCHIVED'
  | 'OWNER_NOT_ACCESSIBLE'
  | 'PAID_FROM_ACCOUNT_INVALID'
  | 'SYSTEM_CATEGORY'
  | 'TAG_TOO_LONG'
  | 'TOO_MANY_TAGS'
  | 'UNSUPPORTED_CURRENCY';
export interface ImportRowError {
  code: ImportErrorCode;
  line: number;
  message: string;
  // Numbers and months the app puts in its own message (cents for values).
  params?: Record<string, number | string>;
}

const KIND_MESSAGES = {
  ACCOUNT_AND_CARD: 'Choose account or card, not both',
  CARD_CREDIT_CATEGORY_MISUSED: 'This category only works for card income',
  CARD_INCOME_CATEGORY: 'Card income must be a refund, a discount or an early payment',
} as const;
const MAX_TAGS = 10;
const MIN_DATE = '1900-01-01';
const MAX_DATE = '2100-12-31';

// The key a row shares with the transaction it may repeat (spec 047 FR 29).
export function duplicateKey(row: {
  accountId?: null | string;
  creditCardId?: null | string;
  date: string;
  description: string;
  type: TransactionType;
  value: number;
}): string {
  return [
    row.date,
    row.value,
    row.type,
    normalizeText(row.description.trim()),
    row.accountId ?? row.creditCardId ?? '',
  ].join('|');
}
export function mapConsistencyError(error: unknown, line: number): ImportRowError | undefined {
  if (
    !(
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnprocessableEntityException
    )
  ) {
    return undefined;
  }

  const message = error.message;
  const code = consistencyCode(message);

  return code ? { code, line, message } : undefined;
}

// Trimmed, empty names dropped (the form does the same); the first spelling of a repeated name wins.
export function normalizeTags(tags?: null | string[]): string[] {
  const seen = new Set<string>();

  return (tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();

      if (tag === '' || seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}

// The checks that need no lookup; `undefined` when the row is fine.
export function validateImportRow(row: ImportRow): ImportRowError | undefined {
  const { line } = row;

  if (
    !CalendarDateSchema.safeParse(row.date).success ||
    row.date < MIN_DATE ||
    row.date > MAX_DATE
  ) {
    return { code: 'INVALID_DATE', line, message: 'Invalid date' };
  }

  if (!ValueSchema.safeParse(row.value).success) {
    return { code: 'INVALID_VALUE', line, message: 'Invalid amount' };
  }

  if (!DescriptionSchema.safeParse(row.description).success) {
    return { code: 'DESCRIPTION_INVALID', line, message: 'Invalid description' };
  }

  const tags = normalizeTags(row.tags);

  if (tags.length > MAX_TAGS) {
    return { code: 'TOO_MANY_TAGS', line, message: 'At most 10 tags' };
  }

  if (tags.some((tag) => !TagNameSchema.safeParse(tag).success)) {
    return { code: 'TAG_TOO_LONG', line, message: 'A tag has at most 30 characters' };
  }

  if (row.currency && !(SUPPORTED_CURRENCIES as readonly string[]).includes(row.currency)) {
    return { code: 'UNSUPPORTED_CURRENCY', line, message: 'Currency not supported' };
  }

  if (!row.accountId && !row.creditCardId) {
    return { code: 'ACCOUNT_NOT_FOUND', line, message: 'Choose an account or a card' };
  }

  if (parseInvoiceMonth(row.invoiceMonth) === 'INVALID') {
    return { code: 'INVOICE_MONTH_INVALID', line, message: 'Invalid invoice month' };
  }

  const kind = importRowKind(row);

  if (typeof kind === 'object') {
    return { code: kind.error, line, message: KIND_MESSAGES[kind.error] };
  }

  return undefined;
}

function consistencyCode(message: string): ImportErrorCode | undefined {
  const table: [string, ImportErrorCode][] = [
    ['System category is reserved', 'SYSTEM_CATEGORY'],
    ['Category is archived', 'CATEGORY_ARCHIVED'],
    ['Category', 'CATEGORY_NOT_FOUND'],
    ['Account is archived', 'ACCOUNT_ARCHIVED'],
    ['Credit card is archived', 'ACCOUNT_ARCHIVED'],
    ['Transaction currency must match', 'CURRENCY_MISMATCH'],
    ['Account', 'ACCOUNT_NOT_FOUND'],
    ['Credit card', 'CARD_NOT_FOUND'],
  ];

  return table.find(([start]) => message.startsWith(start))?.[1];
}
