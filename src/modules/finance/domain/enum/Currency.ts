// Supported ISO 4217 codes (spec 040). A new code is a one-line change here: no Prisma enum, no migration.
export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = 'BRL';
