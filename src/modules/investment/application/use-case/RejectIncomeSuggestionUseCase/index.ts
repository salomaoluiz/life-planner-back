import { Inject, NotFoundException } from '@nestjs/common';

import { DecideSuggestionInput, DecideSuggestionSchema } from '@investment/application/dto/Income';
import { assertPending } from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 107 FR 28: a rejected suggestion never returns, not even after the next events job.
export class RejectIncomeSuggestionUseCase implements UseCaseWithParams<
  DecideSuggestionInput,
  void
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  async execute(params: DecideSuggestionInput): Promise<void> {
    const input = validate(DecideSuggestionSchema, params);
    const suggestion = await this.incomes.findSuggestionById(input.id);

    if (!suggestion) {
      throw new NotFoundException();
    }

    await loadWritableAsset(this.investment, suggestion.assetId, input.accessibleOwners);
    assertPending(suggestion.status);
    await this.incomes.rejectSuggestion(suggestion.id, input.userId);
  }
}
