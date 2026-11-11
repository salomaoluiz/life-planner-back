import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  CreateFractionSaleInput,
  CreateFractionSaleSchema,
} from '@investment/application/dto/EventInput';
import { toAssetDetailView } from '@investment/application/service/AssetView';
import {
  loadWritableAsset,
  OperationWriteResult,
  persistOperation,
} from '@investment/application/service/OperationRules';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentOperationType, isEventType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { fractionUnitPrice } from '@investment/domain/service/CorporateEventMath';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export const FRACTION_ALREADY_SOLD_CODE = 'FRACTION_ALREADY_SOLD';

// Spec 108 FR 15-17: the cash of a fraction auction is a SELL linked to its event. Its quantity is the event's
// fraction, its gross the auction amount; the position's quantity and cost do not change (the fraction already left).
export class CreateFractionSaleUseCase implements UseCaseWithParams<
  CreateFractionSaleInput,
  OperationWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly context: QuoteContextLoader,
  ) {}

  async execute(params: CreateFractionSaleInput): Promise<OperationWriteResult> {
    const input = validate(CreateFractionSaleSchema, params);
    const event = await this.repository.findOperationById(input.eventId);
    const found = event ? await this.repository.findAssetById(event.assetId) : undefined;

    if (!event || !found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    const asset = await loadWritableAsset(this.repository, found.id, input.accessibleOwners);

    if (!isEventType(event.type)) {
      throw new UnprocessableEntityException('This operation has no fraction to sell');
    }
    if (found.operations.some((operation) => operation.fractionOfOperationId === event.id)) {
      throw new ConflictException({
        code: FRACTION_ALREADY_SOLD_CODE,
        message: 'The fraction of this event was already sold',
      });
    }

    const fraction = toAssetDetailView(found).operations.find(
      (view) => view.operation.id === event.id,
    )?.event?.fractionQuantity;

    if (!fraction?.isPositive()) {
      throw new UnprocessableEntityException('This event has no fraction to sell');
    }
    if (input.date < event.date) {
      throw new UnprocessableEntityException('The fraction sale cannot be dated before the event');
    }

    return persistOperation(this.repository, {
      accountId: input.accountId ?? null,
      asset,
      context: await this.context.load([asset]),
      date: input.date,
      fees: input.fees,
      fractionOfOperationId: event.id,
      generateTransaction: input.generateTransaction,
      grossCents: input.grossAmount,
      owners: input.accessibleOwners,
      quantity: fraction,
      type: InvestmentOperationType.SELL,
      unitPrice: fractionUnitPrice(input.grossAmount, fraction),
    });
  }
}
