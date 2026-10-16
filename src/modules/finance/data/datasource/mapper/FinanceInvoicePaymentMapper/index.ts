import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialInvoicePaymentWithAccount } from '@finance/data/repository/datasource/IFinanceInvoicePaymentDatasource';
import InvoicePaymentEntity from '@finance/domain/entity/InvoicePaymentEntity';
import { InvoicePaymentMethod } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceInvoicePaymentMapper {
  static toDomain(raw: FinancialInvoicePaymentWithAccount): InvoicePaymentEntity {
    return new InvoicePaymentEntity({
      accountId: raw.account_id,
      accountName: raw.account?.name ?? null,
      amount: raw.amount,
      createdAt: raw.created_at,
      creditCardId: raw.credit_card_id,
      id: raw.id,
      invoiceMonth: raw.invoice_month,
      method: InvoicePaymentMethod[raw.method],
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      paidOn: toCalendarDate(raw.paid_on),
      transactionId: raw.transaction_id,
      updatedAt: raw.updated_at,
    });
  }
}
