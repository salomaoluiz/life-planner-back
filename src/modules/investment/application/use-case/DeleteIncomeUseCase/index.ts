import { BadRequestException, Inject } from '@nestjs/common';

import { IncomeAccessInput, IncomeAccessSchema } from '@investment/application/dto/Income';
import {
  assertIncomeAccountChangeable,
  loadIncome,
} from '@investment/application/service/IncomeRules';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IncomeSeriesEndReason } from '@investment/domain/enum';
import {
  IIncomeRepository,
  IIncomeSeriesRepository,
  IInvestmentRepository,
} from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 21: removes the income and its finance row (ledger adjusted); its suggestion never comes back.
// Spec 115 FR 25: an income of a series needs a `scope`.
export class DeleteIncomeUseCase implements UseCaseWithParams<IncomeAccessInput, void> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
    @Inject(IncomeSeriesGate) private readonly gate: IncomeSeriesGate,
  ) {}

  async execute(params: IncomeAccessInput): Promise<void> {
    const input = validate(IncomeAccessSchema, params);
    const { income } = await loadIncome(
      this.incomes,
      this.investment,
      input.id,
      input.accessibleOwners,
    );

    await loadWritableAsset(this.investment, income.assetId, input.accessibleOwners);

    if (!income.seriesId) {
      await assertIncomeAccountChangeable(
        this.investment,
        input.accessibleOwners,
        income.accountId,
      );
      await this.incomes.deleteIncome(income.id);

      return;
    }
    if (!input.scope) {
      throw new BadRequestException('scope is required to delete an income of a series');
    }

    await assertIncomeAccountChangeable(this.investment, input.accessibleOwners, income.accountId);

    if (input.scope === 'ONLY_THIS') {
      // The number is skipped for good: the cursor of the series is already past it (034 skipped numbers).
      await this.incomes.deleteIncome(income.id);
    } else if (input.scope === 'THIS_AND_NEXT') {
      await this.seriesRepository.endSeries({
        deleteFromNumber: income.occurrenceNumber ?? 0,
        endedAt: income.paymentDate,
        endReason: IncomeSeriesEndReason.MANUAL,
        id: income.seriesId,
      });
    } else {
      await this.seriesRepository.deleteSeries(income.seriesId);
    }

    this.gate.invalidate(input.accessibleOwners.map((access) => access.ownerId));
  }
}
