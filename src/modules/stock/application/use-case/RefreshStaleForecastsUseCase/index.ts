import { Inject, Injectable } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { StockForecastGate } from '@stock/application/service/StockForecastGate';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockRepository } from '@stock/domain/repository';
import { todayUtc } from '@stock/domain/service/Today';

export interface RefreshStaleForecastsInput {
  owners: OwnerAccess[];
  today?: Date;
}

// Spec 123 FR 14: the dates of a forecast move with time, so a read that returns items first recomputes the items
// whose forecast is older than today (one grouped query and one batched update for all of them), once per owner
// per gate window. Archived owners are read-only and never refreshed.
@Injectable()
export class RefreshStaleForecastsUseCase implements UseCaseWithParams<
  RefreshStaleForecastsInput,
  void
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject(StockForecastGate)
    private readonly gate: StockForecastGate,
  ) {}

  async execute(params: RefreshStaleForecastsInput): Promise<void> {
    const owners = params.owners.filter((owner) => !owner.archived);

    if (owners.length === 0) {
      return;
    }

    const today = params.today ?? todayUtc();

    await this.gate.runOnce(
      owners.map((owner) => `${owner.owner}:${owner.ownerId}`),
      today.toISOString().slice(0, 10),
      async () => {
        const ids = await this.stockRepository.findStaleForecastItemIds(owners, today);

        await this.stockRepository.refreshForecasts(ids, today);
      },
    );
  }
}
