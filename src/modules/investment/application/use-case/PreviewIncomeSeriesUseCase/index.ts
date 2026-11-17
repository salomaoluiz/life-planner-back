import { Inject } from '@nestjs/common';

import {
  PreviewIncomeSeriesInput,
  PreviewIncomeSeriesSchema,
} from '@investment/application/dto/IncomeSeries';
import {
  assertFrequencyAllowed,
  assertPositionAtStart,
  planSeries,
  ruleOf,
} from '@investment/application/service/IncomeSeriesRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { IInvestmentRepository } from '@investment/domain/repository';
import {
  addDays,
  lastDayOfMonth,
  MAX_OCCURRENCES_PER_CREATE,
  occurrencesBetween,
} from '@investment/domain/service/IncomeSeriesSchedule';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface IncomeSeriesPreview {
  endsByPosition: null | string;
  firstNetAmount: null | number;
  firstQuantity: null | string;
  next: string[];
  occurrences: { currentMonth: number; max: number; past: number };
}

const PREVIEW_NEXT = 3;

// Spec 115 section 7: what the create would do, without writing (drives the form preview).
export class PreviewIncomeSeriesUseCase implements UseCaseWithParams<
  PreviewIncomeSeriesInput,
  IncomeSeriesPreview
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
  ) {}

  async execute(params: PreviewIncomeSeriesInput): Promise<IncomeSeriesPreview> {
    const input = validate(PreviewIncomeSeriesSchema, params);
    const asset = await loadWritableAsset(this.investment, input.assetId, input.accessibleOwners);

    assertFrequencyAllowed(input.frequency);

    const draft = {
      amountPerUnit: input.amountPerUnit.toString(),
      endDate: input.endDate ?? null,
      exDateOffsetDays: input.exDateOffsetDays ?? null,
      firstNumber: 1,
      firstPaymentDate: input.firstPaymentDate,
      frequency: input.frequency,
      type: input.type,
    };
    const today = todayInSaoPaulo();

    assertPositionAtStart(asset, draft);

    const plan = planSeries({ afterNumber: 0, asset, draft, markPast: true, today });
    const past = plan.insert.filter((item) => item.received).length;
    const first = plan.insert[0];
    const horizon = lastDayOfMonth(today);
    const rule = ruleOf(draft);
    const next = occurrencesBetween(rule, addDays(horizon, 1), '9999-12-31', PREVIEW_NEXT)
      .map((item) => item.paymentDate)
      .filter((date) => !plan.endsAt || date < plan.endsAt);

    if (plan.count > MAX_OCCURRENCES_PER_CREATE) {
      return {
        endsByPosition: plan.endsAt,
        firstNetAmount: null,
        firstQuantity: null,
        next,
        occurrences: { currentMonth: 0, max: MAX_OCCURRENCES_PER_CREATE, past: plan.count },
      };
    }

    return {
      endsByPosition: plan.endsAt,
      firstNetAmount: first?.netAmount ?? null,
      firstQuantity: first?.quantity ?? null,
      next,
      occurrences: {
        currentMonth: plan.insert.length - past,
        max: MAX_OCCURRENCES_PER_CREATE,
        past,
      },
    };
  }
}
