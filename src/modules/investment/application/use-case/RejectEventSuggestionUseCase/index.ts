import { Inject, NotFoundException } from '@nestjs/common';

import {
  DecideEventSuggestionInput,
  DecideEventSuggestionSchema,
} from '@investment/application/dto/EventInput';
import { assertPending } from '@investment/application/service/IncomeRules';
import { loadWritableAsset } from '@investment/application/service/OperationRules';
import { ICorporateEventRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 108 FR 26: a rejected suggestion never returns, not even after the next events job.
export class RejectEventSuggestionUseCase implements UseCaseWithParams<
  DecideEventSuggestionInput,
  void
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('ICorporateEventRepository') private readonly events: ICorporateEventRepository,
  ) {}

  async execute(params: DecideEventSuggestionInput): Promise<void> {
    const input = validate(DecideEventSuggestionSchema, params);
    const suggestion = await this.events.findSuggestionById(input.id);

    if (!suggestion) {
      throw new NotFoundException();
    }

    await loadWritableAsset(this.investment, suggestion.assetId, input.accessibleOwners);
    assertPending(suggestion.status);
    await this.events.rejectSuggestion(suggestion.id, input.userId);
  }
}
