// Case- and accent-insensitive: "mercadao" finds "MERCADÃO".
export function matchesText(text: string, query: string): boolean {
  return normalizeText(text).includes(normalizeText(query.trim()));
}
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
