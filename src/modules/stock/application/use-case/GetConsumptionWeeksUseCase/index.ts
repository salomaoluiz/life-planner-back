import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetStockItemByIdInput,
  GetStockItemByIdSchema,
} from '@stock/application/dto/GetStockItemById';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockRepository } from '@stock/domain/repository';
import { ConsumptionWeek, weeklyConsumption } from '@stock/domain/service/ConsumptionForecast';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';
import { todayUtc } from '@stock/domain/service/Today';

const WEEKS = 12;

// Spec 123 FR 19: the 12-week consumption chart of one item (one grouped query).
@Injectable()
export class GetConsumptionWeeksUseCase implements UseCaseWithParams<
  GetStockItemByIdInput,
  ConsumptionWeek[]
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: GetStockItemByIdInput): Promise<ConsumptionWeek[]> {
    const input = validate(GetStockItemByIdSchema, params);
    const item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    const today = input.today ?? todayUtc();
    const perDay = await this.stockRepository.findMovementDays(
      item.id,
      today,
      // the Monday-based weeks reach at most 6 days past 84
      WEEKS * 7 + 6,
    );
    const quantity = fromMilli(item.lots.reduce((sum, lot) => sum + toMilli(lot.quantity), 0));

    return weeklyConsumption(quantity, perDay, today, WEEKS);
  }
}
