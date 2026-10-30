import { normalizeText } from '@finance/domain/service/TextMatch';

export interface AmountRange {
  maxCents: number;
  minCents: number;
}
export interface SearchableRow {
  categoryId: string;
  description: string;
  notes: null | string;
  valueCents: number;
}

const INT4_MAX = 2147483647;
// Digits with optional thousand separators, then an optional `,`/`.` decimal part of 1-2 digits.
const AMOUNT = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

// Spec 059 FR 14: a row matches when the query is in its description or notes, names its category (the
// caller resolves the ancestors into `matchingCategoryIds`) or reads as its amount.
export function matchesTransactionQuery(
  row: SearchableRow,
  query: string,
  matchingCategoryIds: ReadonlySet<string>,
): boolean {
  const needle = normalizeText(query.trim());

  if (
    normalizeText(row.description).includes(needle) ||
    normalizeText(row.notes ?? '').includes(needle) ||
    matchingCategoryIds.has(row.categoryId)
  ) {
    return true;
  }

  const range = parseAmountQuery(query);
  const cents = Math.abs(row.valueCents);

  return range !== null && cents >= range.minCents && cents <= range.maxCents;
}

// Spec 059 FR 15: `38` → 38,00..38,99; `38,7` → 38,70..38,79; `38,70` → exactly 38,70. Not a number → null.
export function parseAmountQuery(query: string): AmountRange | null {
  const cleaned = query
    .replace(/R\$/gi, '')
    .replace(/\b[A-Za-z]{3}\b/g, '')
    .replace(/\s+/g, '')
    .replace(/^[-+]/, '');
  const match = AMOUNT.exec(cleaned);

  if (!match) {
    return null;
  }

  const units = Number(match[1].replace(/[.,]/g, ''));
  const decimals = match[2] ?? '';
  const base = units * 100;
  let range: AmountRange = { maxCents: base + 99, minCents: base };

  if (decimals.length === 1) {
    range = { maxCents: base + Number(decimals) * 10 + 9, minCents: base + Number(decimals) * 10 };
  } else if (decimals.length === 2) {
    range = { maxCents: base + Number(decimals), minCents: base + Number(decimals) };
  }

  // Stored amounts are int4: a bigger number can never match (and must not overflow the SQL parameter).
  return range.minCents > INT4_MAX
    ? null
    : { ...range, maxCents: Math.min(range.maxCents, INT4_MAX) };
}
