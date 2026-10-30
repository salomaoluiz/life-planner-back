// Spec 058 FR 12: the typed text becomes lowercase, accent-free words made only of [a-z0-9], so no tsquery operator
// or quote can get through.
export function toSearchTerms(input: string): string[] {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((term) => term.length > 0);
}

// Every word is a prefix term, all of them required: `pas:* & fol:*`.
export function buildPrefixQuery(terms: string[]): string {
  return terms.map((term) => `${term}:*`).join(' & ');
}
