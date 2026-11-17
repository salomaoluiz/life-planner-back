import { Inject } from '@nestjs/common';

import {
  CreateIncomeSeriesInput,
  CreateIncomeSeriesSchema,
} from '@investment/application/dto/IncomeSeries';
import {
  normalizeIncomeNotes,
  resolveIncomeAccount,
  resolveIncomeCategory,
} from '@investment/application/service/IncomeRules';
import { IncomeSeriesGate } from '@investment/application/service/IncomeSeriesGate';
import {
  assertFrequencyAllowed,
  assertMaxOccurrences,
  assertPositionAtStart,
  IncomeSeriesView,
  planSeries,
  toSeriesView,
} from '@investment/application/service/IncomeSeriesRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import {
  IIncomeRepository,
  IIncomeSeriesRepository,
  IInvestmentRepository,
} from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface CreateIncomeSeriesResult extends IncomeSeriesView {
  created: { planned: number; received: number };
}

// Spec 115 FR 12-17: the series and every occurrence up to the end of the current month, in one transaction.
export class CreateIncomeSeriesUseCase implements UseCaseWithParams<
  CreateIncomeSeriesInput,
  CreateIncomeSeriesResult
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
    @Inject('IIncomeSeriesRepository') private readonly seriesRepository: IIncomeSeriesRepository,
    @Inject(IncomeSeriesGate) private readonly gate: IncomeSeriesGate,
  ) {}

  async execute(params: CreateIncomeSeriesInput): Promise<CreateIncomeSeriesResult> {
    const input = validate(CreateIncomeSeriesSchema, params);
    const asset = await loadWritableAsset(this.investment, input.assetId, input.accessibleOwners);
    const notes = normalizeIncomeNotes(input.notes);

    assertFrequencyAllowed(input.frequency);

    if (input.withFinance && input.accountId && input.categoryId) {
      const account = await resolveIncomeAccount(
        this.investment,
        input.accessibleOwners,
        input.accountId,
        asset.currency,
      );

      await resolveIncomeCategory(this.incomes, account, input.categoryId);
    }

    const draft = {
      amountPerUnit: input.amountPerUnit.toString(),
      endDate: input.endDate ?? null,
      exDateOffsetDays: input.exDateOffsetDays ?? null,
      firstNumber: 1,
      firstPaymentDate: input.firstPaymentDate,
      frequency: input.frequency,
      type: input.type,
    };

    assertPositionAtStart(asset, draft);

    const plan = planSeries({
      afterNumber: 0,
      asset,
      draft,
      markPast: input.markPastAsReceived,
      today: todayInSaoPaulo(),
    });

    assertMaxOccurrences(plan.count);

    const id = await this.seriesRepository.createSeries({
      assetLabel: asset.ticker ?? asset.name,
      occurrences: plan.insert,
      series: {
        accountId: input.withFinance ? (input.accountId ?? null) : null,
        amountPerUnit: draft.amountPerUnit,
        assetId: asset.id,
        categoryId: input.withFinance ? (input.categoryId ?? null) : null,
        createdBy: input.userId,
        currency: asset.currency,
        endDate: draft.endDate,
        endedAt: plan.ended?.endedAt ?? null,
        endReason: plan.ended?.endReason ?? null,
        exDateOffsetDays: draft.exDateOffsetDays,
        firstNumber: 1,
        firstPaymentDate: draft.firstPaymentDate,
        frequency: draft.frequency,
        lastGeneratedNumber: plan.lastNumber,
        notes,
        type: input.type,
        withFinance: input.withFinance,
      },
    });
    const series = await this.seriesRepository.findById(id);

    this.gate.invalidate(input.accessibleOwners.map((access) => access.ownerId));

    if (!series) {
      throw new Error('Series not found after creation');
    }

    const received = plan.insert.filter((item) => item.received).length;

    return {
      ...toSeriesView(series),
      created: { planned: plan.insert.length - received, received },
    };
  }
}
