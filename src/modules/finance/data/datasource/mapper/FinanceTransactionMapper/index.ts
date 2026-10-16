import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { InvoicePaymentMethod, SystemCategoryKey, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceTransactionMapper {
  static toDomain(raw: FinancialTransactionWithRelations): TransactionEntity {
    return new TransactionEntity({
      account: raw.account
        ? { icon: raw.account.icon, id: raw.account.id, name: raw.account.name }
        : null,
      accountId: raw.account_id,
      category: {
        excludeFromTotals: raw.category.exclude_from_totals,
        icon: raw.category.icon,
        iconColor: raw.category.icon_color,
        id: raw.category.id,
        name: raw.category.name,
        systemKey: raw.category.system_key ? SystemCategoryKey[raw.category.system_key] : null,
      },
      categoryId: raw.category_id,
      createdAt: raw.created_at,
      creditCard: raw.credit_card
        ? {
            color: raw.credit_card.color,
            id: raw.credit_card.id,
            lastDigits: raw.credit_card.last_digits ?? undefined,
            title: raw.credit_card.title,
          }
        : null,
      creditCardId: raw.credit_card_id,
      date: toCalendarDate(raw.date),
      description: raw.description,
      id: raw.id,
      installmentCount: raw.installment_plan?.installment_count ?? null,
      installmentNumber: raw.installment_number,
      installmentPlanId: raw.installment_plan_id,
      invoiceMonth: raw.invoice_month,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      paidFromAccountId: raw.paid_from_transaction?.account_id ?? null,
      paidFromAccountName: raw.paid_from_transaction?.account?.name ?? null,
      paidFromTransactionId: raw.paid_from_transaction_id,
      paymentMethod: raw.payment_method ? InvoicePaymentMethod[raw.payment_method] : null,
      prepaymentId: raw.prepayment_id,
      refundedName: raw.refunded_transaction?.description ?? raw.refunded_plan?.description ?? null,
      refundedPlanId: raw.refunded_plan_id,
      refundedTransactionId: raw.refunded_transaction_id,
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
      value: raw.value,
    });
  }
}
