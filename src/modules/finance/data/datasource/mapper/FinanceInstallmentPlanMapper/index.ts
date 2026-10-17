import { toCalendarDate } from '@finance/data/datasource/mapper/CalendarDate';
import { FinanceTransactionMapper } from '@finance/data/datasource/mapper/FinanceTransactionMapper';
import { FinancialInstallmentPlanWithRows } from '@finance/data/repository/datasource/IFinanceInstallmentPlanDatasource';
import InstallmentPlanEntity from '@finance/domain/entity/InstallmentPlanEntity';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceInstallmentPlanMapper {
  static toDomain(raw: FinancialInstallmentPlanWithRows): InstallmentPlanEntity {
    return new InstallmentPlanEntity({
      categoryId: raw.category_id,
      createdAt: raw.created_at,
      creditCardId: raw.credit_card_id,
      date: toCalendarDate(raw.date),
      description: raw.description,
      id: raw.id,
      installmentCount: raw.installment_count,
      installments: raw.transactions.map((row) => FinanceTransactionMapper.toDomain(row)),
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      prepayment: raw.prepayment
        ? {
            date: toCalendarDate(raw.prepayment.date),
            discount: raw.prepayment.discount_transaction?.value ?? 0,
            id: raw.prepayment.id,
            targetInvoiceMonth: raw.prepayment.target_invoice_month,
          }
        : null,
      totalValue: raw.total_value,
      updatedAt: raw.updated_at,
    });
  }
}
