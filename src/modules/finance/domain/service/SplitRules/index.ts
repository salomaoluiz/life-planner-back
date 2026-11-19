import { isSplitAdjustmentCategoryId } from '@finance/domain/entity/SystemCategory';
import { TransactionType } from '@finance/domain/enum';

// Spec 119 FR 6: a split has 2 to 50 parts.
export const SPLIT_MIN_PARTS = 2;
export const SPLIT_MAX_PARTS = 50;

export type SplitRuleCode =
  | 'SPLIT_ADJUSTMENT_DUPLICATE'
  | 'SPLIT_CARD_EXPENSE_ONLY'
  | 'SPLIT_PART_VALUE_INVALID'
  | 'SPLIT_SOURCE_NOT_ALLOWED'
  | 'SPLIT_TOO_FEW_PARTS'
  | 'SPLIT_TOO_MANY_PARTS'
  | 'SPLIT_TOTAL_MISMATCH'
  | 'SPLIT_TOTAL_ZERO';

// The application layer maps `code` to a 422 whose message is the code (spec 119 section 7).
export interface SplitRulePart {
  categoryId: string;
  type: TransactionType;
  value: number;
}

export class SplitRuleError extends Error {
  constructor(
    readonly code: SplitRuleCode,
    readonly details?: { difference: number; partsTotal: number; total: number },
  ) {
    super(code);
  }
}

// Income parts minus expense parts (the adjustment keeps its sign): positive = net income, negative = net expense.
export function netOf(parts: Pick<SplitRulePart, 'type' | 'value'>[]): number {
  return parts.reduce(
    (sum, part) => sum + (part.type === TransactionType.INCOME ? part.value : -part.value),
    0,
  );
}

// FR 13: the total shown and compared with the typed one is the magnitude of the net.
export function totalOf(parts: Pick<SplitRulePart, 'type' | 'value'>[]): number {
  return Math.abs(netOf(parts));
}
export function typeOf(parts: Pick<SplitRulePart, 'type' | 'value'>[]): TransactionType {
  return netOf(parts) > 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
}

// FR 6-9, 11, 13: shape of the parts, independent of who owns them.
export function assertParts(
  parts: SplitRulePart[],
  context: { card: boolean; minParts?: number },
): void {
  if (parts.length < (context.minParts ?? SPLIT_MIN_PARTS)) {
    throw new SplitRuleError('SPLIT_TOO_FEW_PARTS');
  }
  if (parts.length > SPLIT_MAX_PARTS) {
    throw new SplitRuleError('SPLIT_TOO_MANY_PARTS');
  }

  let adjustments = 0;

  for (const part of parts) {
    if (context.card && part.type !== TransactionType.EXPENSE) {
      throw new SplitRuleError('SPLIT_CARD_EXPENSE_ONLY');
    }

    if (isSplitAdjustmentCategoryId(part.categoryId)) {
      adjustments += 1;
      if (part.type !== TransactionType.EXPENSE || part.value === 0) {
        throw new SplitRuleError('SPLIT_PART_VALUE_INVALID');
      }
    } else if (part.value <= 0) {
      throw new SplitRuleError('SPLIT_PART_VALUE_INVALID');
    }
  }

  // A single part left dissolves into an ordinary transaction, which can't hold the adjustment's sign (FR 22).
  if (parts.length === 1 && adjustments === 1) {
    throw new SplitRuleError('SPLIT_PART_VALUE_INVALID');
  }
  if (adjustments > 1) {
    throw new SplitRuleError('SPLIT_ADJUSTMENT_DUPLICATE');
  }
  if (netOf(parts) === 0) {
    throw new SplitRuleError('SPLIT_TOTAL_ZERO');
  }
}

// FR 14: a typed total must equal the net; `difference` = typed total - parts total (negative: the parts pass it).
export function assertTotal(parts: SplitRulePart[], total: number | undefined): void {
  if (total === undefined) {
    return;
  }
  const partsTotal = totalOf(parts);

  if (partsTotal !== total) {
    throw new SplitRuleError('SPLIT_TOTAL_MISMATCH', {
      difference: total - partsTotal,
      partsTotal,
      total,
    });
  }
}
