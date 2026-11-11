import { Inject, NotFoundException } from '@nestjs/common';

import {
  ApproveEventSuggestionInput,
  ApproveEventSuggestionSchema,
  EventShapeSchema,
} from '@investment/application/dto/EventInput';
import { assertEventsAllowed, persistEvent } from '@investment/application/service/EventRules';
import { assertPending } from '@investment/application/service/IncomeRules';
import {
  loadWritableAsset,
  OperationWriteResult,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { InvestmentOperationType } from '@investment/domain/enum';
import { ICorporateEventRepository, IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

// A field of the announced event, only while the owner keeps the announced type.
function carried(same: boolean, value: null | string): Decimal8 | null {
  return same && value !== null ? Decimal8.parse(value) : null;
}

// Spec 108 FR 28, 29: approving creates the event operation with the values of the suggestion; any field in the
// body overrides it (the edit path). An error of the position re-run answers 422 and the suggestion stays pending
// because the whole write is one database transaction.
export class ApproveEventSuggestionUseCase implements UseCaseWithParams<
  ApproveEventSuggestionInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('ICorporateEventRepository') private readonly events: ICorporateEventRepository,
    private readonly context: QuoteContextLoader,
  ) {}

  async execute(params: ApproveEventSuggestionInput): Promise<OperationWriteResult> {
    const input = validate(ApproveEventSuggestionSchema, params);
    const suggestion = await this.events.findSuggestionById(input.id);

    if (!suggestion) {
      throw new NotFoundException();
    }

    const asset = await loadWritableAsset(
      this.investment,
      suggestion.assetId,
      input.accessibleOwners,
    );

    assertEventsAllowed(asset);
    assertPending(suggestion.status);

    const { event } = suggestion;
    const type = input.type ?? InvestmentOperationType[event.type];
    // The fields of the suggestion only carry over while the type is the one the provider announced.
    const same = type === InvestmentOperationType[event.type];
    const shape = validate(EventShapeSchema, {
      bonusPercent: input.bonusPercent ?? carried(same, event.bonusPercent),
      bonusUnitCost:
        input.bonusUnitCost === undefined
          ? carried(same, event.bonusUnitCost)
          : input.bonusUnitCost,
      ratioFrom: input.ratioFrom ?? carried(same, event.ratioFrom),
      ratioTo: input.ratioTo ?? carried(same, event.ratioTo),
      type,
    });

    return persistEvent(
      this.investment,
      asset,
      {
        assetId: asset.id,
        bonusPercent: shape.bonusPercent ?? null,
        bonusUnitCost: shape.bonusUnitCost ?? null,
        date: input.date ?? event.recordDate,
        decidedBy: input.userId,
        eventSuggestionId: suggestion.id,
        ratioFrom: shape.ratioFrom ?? null,
        ratioTo: shape.ratioTo ?? null,
        type,
      },
      await this.context.load([asset]),
    );
  }
}
