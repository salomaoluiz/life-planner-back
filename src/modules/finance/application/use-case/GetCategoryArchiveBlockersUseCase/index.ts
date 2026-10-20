import { Inject } from '@nestjs/common';

import {
  CategoryArchiveBlockers,
  GetCategoryArchiveBlockersInput,
  GetCategoryArchiveBlockersSchema,
} from '@finance/application/dto/CategoryBlockers';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { RecurrenceStatus } from '@finance/domain/enum';
import {
  IFinanceInstallmentPlanRepository,
  IFinanceRecurrenceRepository,
} from '@finance/domain/repository';
import { invoiceMonthOf } from '@finance/domain/service/InvoiceCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 041 FR 7: active recurrences and installment plans that still have installments after the card's
// current invoice block the archive of a category (and of its subtree). One query per kind.
export class GetCategoryArchiveBlockersUseCase implements UseCaseWithParams<
  GetCategoryArchiveBlockersInput,
  CategoryArchiveBlockers
> {
  constructor(
    @Inject('IFinanceRecurrenceRepository')
    private readonly recurrenceRepository: IFinanceRecurrenceRepository,
    @Inject('IFinanceInstallmentPlanRepository')
    private readonly planRepository: IFinanceInstallmentPlanRepository,
  ) {}

  async execute(params: GetCategoryArchiveBlockersInput): Promise<CategoryArchiveBlockers> {
    const input = validate(GetCategoryArchiveBlockersSchema, params);
    const ids = new Set(input.categoryIds);
    const result: CategoryArchiveBlockers = {
      hiddenCount: 0,
      installmentPlans: [],
      recurrences: [],
    };

    const series = await this.recurrenceRepository.findByOwners(input.scopes, {
      status: RecurrenceStatus.ACTIVE,
    });

    for (const recurrence of series.filter((item) => ids.has(item.categoryId))) {
      if (!hasOwnerAccess(input.accessibleOwners, recurrence)) {
        result.hiddenCount += 1;
        continue;
      }

      result.recurrences.push({
        categoryId: recurrence.categoryId,
        description: recurrence.description,
        id: recurrence.id,
        nextOccurrenceDate: recurrence.nextOccurrenceDate,
      });
    }

    const plans = await this.planRepository.findPlansByCategoryIds(input.categoryIds);

    for (const { closingDay, plan } of plans) {
      const current = invoiceMonthOf(input.today, closingDay);
      const months = plan.installments
        .map((installment) => installment.invoiceMonth)
        .filter((month): month is string => month !== null && month > current)
        .sort();

      if (months.length === 0) {
        continue;
      }

      if (!hasOwnerAccess(input.accessibleOwners, plan)) {
        result.hiddenCount += 1;
        continue;
      }

      result.installmentPlans.push({
        categoryId: plan.categoryId,
        description: plan.description,
        id: plan.id,
        lastInvoiceMonth: months[months.length - 1],
        remainingInstallments: months.length,
      });
    }

    return result;
  }
}
