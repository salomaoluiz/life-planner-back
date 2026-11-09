export type TransferRuleCode =
  | 'TRANSFER_AMOUNT_IN_REQUIRED'
  | 'TRANSFER_AMOUNT_MISMATCH'
  | 'TRANSFER_DATE_IN_BEFORE_OUT'
  | 'TRANSFER_SAME_ACCOUNT';

// The application layer maps `code` to a 422 whose message is the code (spec 098 section 7).
export class TransferRuleError extends Error {
  constructor(readonly code: TransferRuleCode) {
    super(code);
  }
}

interface ResolveAmountInInput {
  amountIn?: null | number;
  amountOut: number;
  currencyIn: string;
  currencyOut: string;
  // An occurrence of a transfer series may stay without the amount in until it is paid.
  isSeriesOccurrence: boolean;
  paid: boolean;
}

// Spec 098 FR 3/5: same currency fills and validates the amount in; different currencies need it, except for an unpaid series occurrence.
export function resolveAmountIn(input: ResolveAmountInInput): null | number {
  const { amountIn, amountOut, currencyIn, currencyOut, isSeriesOccurrence, paid } = input;

  if (currencyIn === currencyOut) {
    if (amountIn !== undefined && amountIn !== null && amountIn !== amountOut) {
      throw new TransferRuleError('TRANSFER_AMOUNT_MISMATCH');
    }

    return amountOut;
  }

  if (amountIn !== undefined && amountIn !== null) {
    return amountIn;
  }

  if (isSeriesOccurrence && !paid) {
    return null;
  }

  throw new TransferRuleError('TRANSFER_AMOUNT_IN_REQUIRED');
}

// Calendar dates `YYYY-MM-DD` compare as strings.
export function assertDates(dateOut: string, dateIn: string): void {
  if (dateIn < dateOut) {
    throw new TransferRuleError('TRANSFER_DATE_IN_BEFORE_OUT');
  }
}

export function assertAccounts(fromAccountId: string, toAccountId: string): void {
  if (fromAccountId === toAccountId) {
    throw new TransferRuleError('TRANSFER_SAME_ACCOUNT');
  }
}
