import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { toTagRefs } from '@finance/data/datasource/tags';
import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import {
  InvoicePaymentMethod,
  RecurrenceFrequency,
  SystemCategoryKey,
  TransactionType,
} from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { totalOccurrences } from '@finance/domain/service/RecurrenceSchedule';
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
      currency: raw.currency as CurrencyCode,
      date: toCalendarDate(raw.date),
      description: raw.description,
      earlyPayment: raw.early_payment
        ? {
            creditCardId: raw.early_payment.credit_card_id as string,
            id: raw.early_payment.id,
            invoiceMonth: raw.early_payment.invoice_month as string,
          }
        : null,
      id: raw.id,
      installmentCount: raw.installment_plan?.installment_count ?? null,
      installmentNumber: raw.installment_number,
      installmentPlanId: raw.installment_plan_id,
      invoiceMonth: raw.invoice_month,
      notes: raw.notes,
      occurrenceCount: raw.recurrence
        ? totalOccurrences(
            {
              endDate: raw.recurrence.end_date ? toCalendarDate(raw.recurrence.end_date) : null,
              frequency: RecurrenceFrequency[raw.recurrence.frequency],
              startDate: toCalendarDate(raw.recurrence.start_date),
            },
            raw.recurrence.first_number,
          )
        : null,
      occurrenceNumber: raw.occurrence_number,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      paid: raw.paid === true,
      paidFromAccountId: raw.paid_from_transaction?.account_id ?? null,
      paidFromAccountName: raw.paid_from_transaction?.account?.name ?? null,
      paidFromTransactionId: raw.paid_from_transaction_id,
      paymentMethod: raw.payment_method ? InvoicePaymentMethod[raw.payment_method] : null,
      prepaymentId: raw.prepayment_id,
      recurrenceFrequency: raw.recurrence ? RecurrenceFrequency[raw.recurrence.frequency] : null,
      recurrenceId: raw.recurrence_id,
      refundedName: raw.refunded_transaction?.description ?? raw.refunded_plan?.description ?? null,
      refundedPlanId: raw.refunded_plan_id,
      refundedTransactionId: raw.refunded_transaction_id,
      tags: toTagRefs(raw.tags),
      type: TransactionType[raw.type],
      updatedAt: raw.updated_at,
      value: raw.value,
    });
  }
}
