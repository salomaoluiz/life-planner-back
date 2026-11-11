import { Inject } from '@nestjs/common';

import { CreateEventInput, CreateEventSchema } from '@investment/application/dto/EventInput';
import { assertEventsAllowed, persistEvent } from '@investment/application/service/EventRules';
import {
  loadWritableAsset,
  OperationWriteResult,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 108 FR 1-14: a split, reverse split or bonus; the position is re-run inside the write transaction.
export class CreateEventUseCase implements UseCaseWithParams<
  CreateEventInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly context: QuoteContextLoader,
  ) {}

  async execute(params: CreateEventInput): Promise<OperationWriteResult> {
    const input = validate(CreateEventSchema, params);
    const asset = await loadWritableAsset(this.repository, input.assetId, input.accessibleOwners);

    assertEventsAllowed(asset);

    return persistEvent(
      this.repository,
      asset,
      {
        assetId: asset.id,
        bonusPercent: input.bonusPercent ?? null,
        bonusUnitCost: input.bonusUnitCost ?? null,
        date: input.date,
        ratioFrom: input.ratioFrom ?? null,
        ratioTo: input.ratioTo ?? null,
        type: input.type,
      },
      await this.context.load([asset]),
    );
  }
}
