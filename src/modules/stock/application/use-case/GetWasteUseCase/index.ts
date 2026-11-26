import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetWasteInput, GetWasteSchema } from '@stock/application/dto/GetWaste';
import { loadCatalogLookup } from '@stock/application/service/StockView';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';
import { todayUtc } from '@stock/domain/service/Today';
import { buildWasteReport, TOP_ITEMS_LIMIT, WasteReport } from '@stock/domain/service/WasteReport';

// Spec 123 FR 29-31: the Waste screen of a month for the readable owners ("Todas" skips archived families).
@Injectable()
export class GetWasteUseCase implements UseCaseWithParams<GetWasteInput, WasteReport> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetWasteInput): Promise<WasteReport> {
    const input = validate(GetWasteSchema, params);
    const today = input.today ?? todayUtc();
    const current = today.toISOString().slice(0, 7);
    const month = input.month ?? current;

    if (month > current) {
      throw new BadRequestException('The month cannot be after the current one');
    }

    const owners = narrowOwners(input.accessibleOwners, input.ownerId);
    const from = monthStart(month);
    const to = monthStart(nextMonth(month));
    const previousFrom = monthStart(previousMonth(month));
    const [groups, itemRows, firstDiscard, catalog] = await Promise.all([
      this.stockRepository.findWasteGroups(owners, { from, previousFrom, to }),
      this.stockRepository.findWasteItems(owners, { from, to }),
      this.stockRepository.findFirstDiscardDate(owners),
      loadCatalogLookup(this.catalogRepository, owners),
    ]);
    const byId = new Map(catalog.categories.map((category) => [category.id, category]));

    return buildWasteReport({
      firstDiscard,
      groups,
      itemRows,
      month,
      rootOf: (categoryId) => {
        let root = byId.get(categoryId);

        while (root?.parentId && byId.has(root.parentId)) {
          root = byId.get(root.parentId);
        }

        return root && { id: root.id, name: root.name };
      },
      topLimit: input.topLimit ?? TOP_ITEMS_LIMIT,
    });
  }
}

function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}
function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);

  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
}
function previousMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);

  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, '0')}`;
}
