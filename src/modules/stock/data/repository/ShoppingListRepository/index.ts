import { Inject, Injectable } from '@nestjs/common';

import { OwnerType, ShoppingListRowOrigin, StockUnit } from '@db/client';
import { ShoppingListMapper } from '@stock/data/datasource/mapper/ShoppingListMapper';
import { IShoppingListDatasource } from '@stock/data/repository/datasource/IShoppingListDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import {
  AddShoppingListRowParams,
  CreateShoppingListParams,
  IShoppingListRepository,
  ShoppingRowRecord,
  UpdateShoppingListParams,
  UpdateShoppingListRowParams,
} from '@stock/domain/repository';

function toKey(access: Pick<OwnerAccess, 'owner' | 'ownerId'>) {
  return { owner: access.owner as OwnerType, owner_id: access.ownerId };
}

@Injectable()
export class ShoppingListRepository implements IShoppingListRepository {
  constructor(
    @Inject('IShoppingListDatasource')
    private readonly datasource: IShoppingListDatasource,
  ) {}

  async addRow(
    params: AddShoppingListRowParams,
  ): Promise<{ merged: boolean; row: ShoppingRowRecord }> {
    const result = await this.datasource.addRow({
      description: params.description,
      estimated_unit_price_cents: params.estimatedUnitPriceCents,
      item_id: params.itemId,
      list_id: params.listId,
      origin: params.origin as ShoppingListRowOrigin | undefined,
      quantity: params.quantity,
      restore: params.restore,
      unit: params.unit as StockUnit | undefined,
      user_id: params.userId,
    });

    return { merged: result.merged, row: ShoppingListMapper.toRecord(result.row) };
  }

  async create(params: CreateShoppingListParams): Promise<ShoppingListEntity> {
    return ShoppingListMapper.toList(
      await this.datasource.create({
        currency: params.currency,
        is_default: params.isDefault,
        name: params.name,
        owner: params.owner as OwnerType,
        owner_id: params.ownerId,
      }),
    );
  }

  async deleteByOwner(access: OwnerAccess): Promise<void> {
    await this.datasource.deleteByOwner(toKey(access));
  }

  async deleteRow(rowId: string, userId: string): Promise<void> {
    await this.datasource.deleteRow(rowId, userId);
  }

  async ensureDefault(access: OwnerAccess, name: string): Promise<ShoppingListEntity> {
    return ShoppingListMapper.toList(await this.datasource.ensureDefault(toKey(access), name));
  }

  async findById(id: string): Promise<ShoppingListEntity | undefined> {
    const raw = await this.datasource.findById(id);

    return raw ? ShoppingListMapper.toList(raw) : undefined;
  }

  async findByOwners(owners: OwnerAccess[], includeArchived: boolean) {
    const rows = await this.datasource.findByOwners(owners.map(toKey), includeArchived);

    return rows.map((row) => ShoppingListMapper.toList(row));
  }

  async findRestockRows(owners: OwnerAccess[]): Promise<ShoppingRowRecord[]> {
    const rows = await this.datasource.findRestockRows(owners.map(toKey));

    return rows.map((row) => ShoppingListMapper.toRecord(row));
  }

  async findRowById(id: string): Promise<ShoppingRowRecord | undefined> {
    const raw = await this.datasource.findRowById(id);

    return raw ? ShoppingListMapper.toRecord(raw) : undefined;
  }

  async findRowsByLists(listIds: string[]): Promise<ShoppingRowRecord[]> {
    const rows = await this.datasource.findRowsByLists(listIds);

    return rows.map((row) => ShoppingListMapper.toRecord(row));
  }

  async update(params: UpdateShoppingListParams): Promise<ShoppingListEntity> {
    return ShoppingListMapper.toList(
      await this.datasource.update({
        currency: params.currency,
        default_finance_category_id: params.defaultFinanceCategoryId,
        default_market_id: params.defaultMarketId,
        id: params.id,
        is_default: params.isDefault,
        name: params.name,
        status: params.status,
      }),
    );
  }

  async updateRow(params: UpdateShoppingListRowParams): Promise<ShoppingRowRecord> {
    return ShoppingListMapper.toRecord(
      await this.datasource.updateRow({
        description: params.description,
        estimated_unit_price_cents: params.estimatedUnitPriceCents,
        id: params.id,
        quantity: params.quantity,
        unit: params.unit as StockUnit | undefined,
      }),
    );
  }
}
