import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetRestockSummaryInput,
  GetRestockSummarySchema,
} from '@stock/application/dto/ShoppingList';
import { toRowView } from '@stock/application/service/ShoppingListView';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { IShoppingListRepository } from '@stock/domain/repository';

export const RESTOCK_SUMMARY_ROW_LIMIT = 5;

export interface RestockSummary {
  count: number;
  groups: {
    list: ShoppingListEntity;
    rows: { description: string; quantity: number; unit: string }[];
  }[];
  totals: { currency: string; estimatedTotalCents: number; pricedCount: number }[];
}

// Spec 118 FR 23 and 26: the AUTO and AUTO_EDITED rows of every readable active list; at most 5 rows are listed,
// the count and the estimate per currency cover all of them.
export class GetRestockSummaryUseCase implements UseCaseWithParams<
  GetRestockSummaryInput,
  RestockSummary
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject(RefreshStaleForecastsUseCase)
    private readonly refreshStaleForecasts: RefreshStaleForecastsUseCase,
  ) {}

  async execute(params: GetRestockSummaryInput): Promise<RestockSummary> {
    const input = validate(GetRestockSummarySchema, params);
    const owners = narrowOwners(input.accessibleOwners);

    await this.refreshStaleForecasts.execute({ owners });

    const records = await this.listRepository.findRestockRows(owners);
    const views = records
      .map((record) => ({ list: record.list, view: toRowView(record) }))
      .sort(
        (a, b) =>
          Number(b.list.isDefault) - Number(a.list.isDefault) ||
          a.list.name.localeCompare(b.list.name) ||
          a.list.id.localeCompare(b.list.id) ||
          a.view.description.localeCompare(b.view.description),
      );
    const totals = new Map<string, { estimatedTotalCents: number; pricedCount: number }>();

    for (const { list, view } of views) {
      const total = totals.get(list.currency) ?? { estimatedTotalCents: 0, pricedCount: 0 };

      totals.set(list.currency, {
        estimatedTotalCents: total.estimatedTotalCents + (view.estimateCents ?? 0),
        pricedCount: total.pricedCount + (view.estimateCents === undefined ? 0 : 1),
      });
    }

    const groups: RestockSummary['groups'] = [];

    for (const { list, view } of views.slice(0, RESTOCK_SUMMARY_ROW_LIMIT)) {
      const group = groups.find((candidate) => candidate.list.id === list.id);
      const row = { description: view.description, quantity: view.quantity, unit: view.unit };

      if (group) {
        group.rows.push(row);
      } else {
        groups.push({ list, rows: [row] });
      }
    }

    return {
      count: views.length,
      groups,
      totals: [...totals.entries()].map(([currency, total]) => ({ currency, ...total })),
    };
  }
}
