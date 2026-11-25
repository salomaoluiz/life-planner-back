import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { GetShoppingListsInput, GetShoppingListsSchema } from '@stock/application/dto/ShoppingList';
import { ShoppingListCard, toListCards } from '@stock/application/service/ShoppingListView';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';
import { narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { IShoppingListRepository } from '@stock/domain/repository';
import { defaultListName } from '@stock/domain/service/DefaultListName';

// Spec 118 FR 2 and 20: the cards of the lists screen. "Todas" (no ownerId) skips archived families; each
// writable owner gets its default list on the first read.
export class GetShoppingListsUseCase implements UseCaseWithParams<
  GetShoppingListsInput,
  ShoppingListCard[]
> {
  constructor(
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
    @Inject(RefreshStaleForecastsUseCase)
    private readonly refreshStaleForecasts: RefreshStaleForecastsUseCase,
  ) {}

  async execute(params: GetShoppingListsInput): Promise<ShoppingListCard[]> {
    const input = validate(GetShoppingListsSchema, params);
    const owners = narrowOwners(input.accessibleOwners, input.ownerId);

    await Promise.all(
      owners
        .filter((owner) => !owner.archived)
        .map(async (owner) =>
          this.listRepository.ensureDefault(owner, defaultListName(input.language)),
        ),
    );

    // Spec 123 FR 14: stale forecasts (and their FORECAST rows) are recomputed before the read.
    await this.refreshStaleForecasts.execute({ owners });

    const lists = await this.listRepository.findByOwners(owners, input.includeArchived);
    const listIds = lists.map((list) => list.id);
    const [rows, closedDates] = await Promise.all([
      this.listRepository.findRowsByLists(listIds),
      this.listRepository.findClosedPurchaseDates(listIds),
    ]);

    return toListCards(lists, rows, closedDates);
  }
}
