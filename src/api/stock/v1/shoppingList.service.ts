import { Injectable } from '@nestjs/common';

import {
  AddShoppingListRowApiInput,
  CreateShoppingListApiInput,
  UpdateShoppingListApiInput,
  UpdateShoppingListRowApiInput,
} from '@api/stock/v1/dto/shoppingList.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  ShoppingListCard,
  ShoppingListDetail,
  ShoppingRowView,
} from '@stock/application/service/ShoppingListView';
import { AddShoppingListRowUseCase } from '@stock/application/use-case/AddShoppingListRowUseCase';
import { CreateShoppingListUseCase } from '@stock/application/use-case/CreateShoppingListUseCase';
import { DeleteShoppingListRowUseCase } from '@stock/application/use-case/DeleteShoppingListRowUseCase';
import { GetRestockSummaryUseCase } from '@stock/application/use-case/GetRestockSummaryUseCase';
import { GetShoppingListByIdUseCase } from '@stock/application/use-case/GetShoppingListByIdUseCase';
import { GetShoppingListsUseCase } from '@stock/application/use-case/GetShoppingListsUseCase';
import { UpdateShoppingListRowUseCase } from '@stock/application/use-case/UpdateShoppingListRowUseCase';
import { UpdateShoppingListUseCase } from '@stock/application/use-case/UpdateShoppingListUseCase';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

function toListOutput(list: ShoppingListEntity) {
  return {
    currency: list.currency as 'BRL' | 'EUR' | 'USD',
    id: list.id,
    isDefault: list.isDefault,
    name: list.name,
    owner: list.owner,
    ownerId: list.ownerId,
    status: list.status,
  };
}
function toRowOutput(row: ShoppingRowView) {
  return {
    description: row.description,
    estimateCents: row.estimateCents ?? null,
    id: row.id,
    itemId: row.itemId ?? null,
    origin: row.origin,
    priceSource: row.priceSource,
    quantity: row.quantity,
    stock: row.stock
      ? {
          categoryPath: row.stock.categoryPath ?? null,
          idealQuantity: row.stock.idealQuantity ?? null,
          minQuantity: row.stock.minQuantity ?? null,
          quantity: row.stock.quantity,
        }
      : null,
    unit: row.unit,
    unitPriceCents: row.unitPriceCents ?? null,
  };
}

@Injectable()
export class ShoppingListService {
  constructor(
    private readonly addShoppingListRowUseCase: AddShoppingListRowUseCase,
    private readonly createShoppingListUseCase: CreateShoppingListUseCase,
    private readonly deleteShoppingListRowUseCase: DeleteShoppingListRowUseCase,
    private readonly getRestockSummaryUseCase: GetRestockSummaryUseCase,
    private readonly getShoppingListByIdUseCase: GetShoppingListByIdUseCase,
    private readonly getShoppingListsUseCase: GetShoppingListsUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly updateShoppingListRowUseCase: UpdateShoppingListRowUseCase,
    private readonly updateShoppingListUseCase: UpdateShoppingListUseCase,
  ) {}

  async addRow(
    userId: string,
    listId: string,
    input: AddShoppingListRowApiInput,
  ): Promise<{ merged: boolean; row: ReturnType<typeof toRowOutput> }> {
    const result = await this.addShoppingListRowUseCase.execute({
      ...input,
      accessibleOwners: (await this.access(userId)).owners,
      listId,
      userId,
    });

    return { merged: result.merged, row: toRowOutput(result.row) };
  }

  async create(userId: string, input: CreateShoppingListApiInput, language?: string) {
    return toListOutput(
      await this.createShoppingListUseCase.execute({
        ...input,
        accessibleOwners: (await this.access(userId)).owners,
        language: language as 'en-US' | 'pt-BR' | undefined,
      }),
    );
  }

  async deleteRow(userId: string, rowId: string): Promise<void> {
    await this.deleteShoppingListRowUseCase.execute({
      accessibleOwners: (await this.access(userId)).owners,
      id: rowId,
      userId,
    });
  }

  async findAll(
    userId: string,
    query: { includeArchived: boolean; ownerId?: string },
    language?: string,
  ) {
    const cards: ShoppingListCard[] = await this.getShoppingListsUseCase.execute({
      accessibleOwners: (await this.access(userId)).owners,
      includeArchived: query.includeArchived,
      language: language as 'en-US' | 'pt-BR' | undefined,
      ownerId: query.ownerId,
    });

    return {
      items: cards.map((card) => ({
        ...toListOutput(card.list),
        autoCount: card.autoCount,
        estimatedTotalCents: card.estimatedTotalCents,
        pricedCount: card.pricedCount,
        rowCount: card.rowCount,
      })),
    };
  }

  async findById(userId: string, id: string) {
    const detail: ShoppingListDetail = await this.getShoppingListByIdUseCase.execute({
      accessibleOwners: (await this.access(userId)).owners,
      id,
    });

    return {
      groups: detail.groups.map((group) => ({
        category: group.category
          ? { id: group.category.id, name: group.category.name, path: group.category.path }
          : null,
        rows: group.rows.map((row) => toRowOutput(row)),
        subtotalCents: group.subtotalCents,
        unpricedCount: group.unpricedCount,
      })),
      list: toListOutput(detail.list),
      totals: detail.totals,
    };
  }

  async restockSummary(userId: string) {
    const { families, owners } = await this.access(userId);
    const summary = await this.getRestockSummaryUseCase.execute({ accessibleOwners: owners });
    const names = new Map(families.map((family) => [family.familyId, family.name]));

    return {
      count: summary.count,
      groups: summary.groups.map((group) => ({
        list: {
          id: group.list.id,
          name: group.list.name,
          owner: group.list.owner,
          ownerName:
            group.list.owner === OwnerType.FAMILY ? (names.get(group.list.ownerId) ?? null) : null,
        },
        rows: group.rows.map((row) => ({
          description: row.description,
          quantity: row.quantity,
          unit: row.unit as StockUnits,
        })),
      })),
      totals: summary.totals,
    };
  }

  async update(userId: string, id: string, input: UpdateShoppingListApiInput) {
    return toListOutput(
      await this.updateShoppingListUseCase.execute({
        ...input,
        accessibleOwners: (await this.access(userId)).owners,
        id,
      }),
    );
  }

  async updateRow(userId: string, rowId: string, input: UpdateShoppingListRowApiInput) {
    return toRowOutput(
      await this.updateShoppingListRowUseCase.execute({
        ...input,
        accessibleOwners: (await this.access(userId)).owners,
        id: rowId,
      }),
    );
  }

  // Resolved on every request: the caller plus every family they own or joined (spec 005, C1).
  private async access(userId: string) {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);
    const owners: OwnerAccess[] = [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];

    return { families, owners };
  }
}
