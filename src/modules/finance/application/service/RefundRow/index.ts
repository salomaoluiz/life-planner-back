import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { SystemCategoryKey } from '@finance/domain/enum';

// The rows the refund endpoints edit and delete: refunds, and discounts with no prepayment record (the ones the
// CSV import writes, spec 048 FR 21). A discount of a real prepayment is changed through the prepayment.
export function isRefundRow(
  transaction: Pick<TransactionEntity, 'category' | 'prepaymentId'>,
): boolean {
  const key = transaction.category.systemKey;

  return (
    key === SystemCategoryKey.CARD_REFUND ||
    (key === SystemCategoryKey.INSTALLMENT_PREPAYMENT_DISCOUNT && !transaction.prepaymentId)
  );
}
