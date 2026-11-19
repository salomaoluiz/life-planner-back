// Spec 118 FR 2: the default list is named by the requester's language (pt-BR without one).
export function defaultListName(language?: string): string {
  return language === 'en-US' ? 'Groceries' : 'Mercado';
}
