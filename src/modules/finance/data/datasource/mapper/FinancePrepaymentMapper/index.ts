import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinancialPrepaymentWithDiscount } from '@finance/data/repository/datasource/IFinancePrepaymentDatasource';
import PrepaymentEntity from '@finance/domain/entity/PrepaymentEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinancePrepaymentMapper {
  static toDomain(raw: FinancialPrepaymentWithDiscount): PrepaymentEntity {
    return new PrepaymentEntity({
      createdAt: raw.created_at,
      date: toCalendarDate(raw.date),
      discount: raw.discount_transaction?.value ?? 0,
      discountTransactionId: raw.discount_transaction_id,
      id: raw.id,
      installmentPlanId: raw.installment_plan_id,
      originalMonths: raw.original_months as Record<string, string>,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      targetInvoiceMonth: raw.target_invoice_month,
      updatedAt: raw.updated_at,
    });
  }
}
