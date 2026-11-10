import { UnprocessableEntityException } from '@nestjs/common';

import {
  SimulateFixedIncomeInput,
  SimulateFixedIncomeSchema,
} from '@investment/application/dto/FixedIncome';
import { toRateWrite } from '@investment/application/service/FixedIncomeRules';
import { calculateTitle, Totals } from '@investment/domain/service/FixedIncomeCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface SimulateFixedIncomeResult {
  atMaturity: Totals;
  effectiveRate: string;
}

// Spec 105 FR 34: the estimate of a title that does not exist yet, with the same services and nothing written.
export class SimulateFixedIncomeUseCase implements UseCaseWithParams<
  SimulateFixedIncomeInput,
  SimulateFixedIncomeResult
> {
  async execute(params: SimulateFixedIncomeInput): Promise<SimulateFixedIncomeResult> {
    const input = validate(SimulateFixedIncomeSchema, params);

    if (input.maturityDate <= input.date) {
      throw new UnprocessableEntityException('The maturity must be after the first contribution');
    }

    const rate = toRateWrite(input.rate, input.date);
    const result = calculateTitle({
      adjustments: [],
      lots: [{ date: input.date, operationId: 'simulation', principal: input.amount }],
      on: input.maturityDate,
      rates: [{ effectiveRate: Number(rate.effectiveRate), startDate: input.date }],
      redemptions: [],
      terms: { maturityDate: input.maturityDate, taxExempt: input.taxExempt },
    });

    return { atMaturity: result.totals, effectiveRate: rate.effectiveRate };
  }
}
