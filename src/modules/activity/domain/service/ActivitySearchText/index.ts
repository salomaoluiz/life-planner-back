// Case- and accent-insensitive: "mercadao" finds "MERCADÃO".
export interface SearchTextParts {
  amountCents?: null | number;
  itemLabels?: readonly string[];
  label: string;
  sources?: readonly string[];
}

export function normalizeActivityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// 120000 → `120000`, `1200`, `1200,00`, `1.200,00`: whatever the user types for that amount (sign ignored, spec 059 FR 15).
export function amountVariants(amountCents: number): string[] {
  const cents = Math.abs(Math.trunc(amountCents));
  const units = Math.trunc(cents / 100);
  const decimals = String(cents % 100).padStart(2, '0');
  const grouped = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return [String(cents), String(units), `${units},${decimals}`, `${grouped},${decimals}`];
}

// Spec 127 FR 9: the normalized text the `q` filter searches (label, sources, batch item labels, amount).
export function buildSearchText(parts: SearchTextParts): string {
  const words = [parts.label, ...(parts.sources ?? []), ...(parts.itemLabels ?? [])]
    .map(normalizeActivityText)
    .filter((word) => word !== '');
  const amounts =
    parts.amountCents === undefined || parts.amountCents === null
      ? []
      : amountVariants(parts.amountCents);

  return [...new Set([...amounts, ...words])].join(' ');
}

// What the `q` filter compares against `search_text`: the normalized query plus, when it reads as an amount, its cents.
export function toActivityTerms(query: string): { amount: null | string; text: string } {
  const text = normalizeActivityText(query.trim());
  const cleaned = query.replace(/R\$/gi, '').replace(/\s+/g, '').replace(/^[-+]/, '');
  const match = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);

  if (!match) {
    return { amount: null, text };
  }

  const units = match[1].replace(/[.,]/g, '');
  const decimals = match[2];

  return {
    amount: decimals === undefined ? units : `${units},${decimals.padEnd(2, '0')}`,
    text,
  };
}
