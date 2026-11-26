import { Inject, Injectable } from '@nestjs/common';

import { AccountStatus } from '@db/client';
import { ShoppingListMapper } from '@stock/data/datasource/mapper/ShoppingListMapper';
import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import { IStockCatalogDatasource } from '@stock/data/repository/datasource/IStockCatalogDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import {
  CatalogMove,
  CreateStockCategoryParams,
  CreateStockLocationParams,
  IStockCatalogRepository,
  UpdateStockCategoryParams,
  UpdateStockLocationParams,
} from '@stock/domain/repository';

function key(access: OwnerAccess) {
  return { owner: access.owner, owner_id: access.ownerId };
}
function toCategoryData(params: CreateStockCategoryParams) {
  return {
    color: params.color,
    finance_category_id: params.financeCategoryId,
    icon: params.icon,
    name: params.name,
    owner: params.owner,
    owner_id: params.ownerId,
    parent_id: params.parentId,
  };
}
function toLocationData(params: CreateStockLocationParams) {
  return {
    color: params.color,
    icon: params.icon,
    name: params.name,
    owner: params.owner,
    owner_id: params.ownerId,
    parent_id: params.parentId,
  };
}

@Injectable()
export class StockCatalogRepository implements IStockCatalogRepository {
  constructor(
    @Inject('IStockCatalogDatasource')
    private readonly datasource: IStockCatalogDatasource,
  ) {}

  async countItemsByCategory(access: OwnerAccess): Promise<Map<string, number>> {
    const rows = await this.datasource.countItemsByCategory(key(access));

    return new Map(rows.map((row) => [row.category_id, row.count]));
  }

  async countItemsByLocation(access: OwnerAccess): Promise<Map<string, number>> {
    const rows = await this.datasource.countItemsByLocation(key(access));

    return new Map(rows.map((row) => [row.location_id, row.count]));
  }

  async createCategories(params: CreateStockCategoryParams[]): Promise<StockCategoryEntity[]> {
    const rows = await this.datasource.createCategories(params.map(toCategoryData));

    return rows.map((row) => StockMapper.toCategory(row));
  }

  async createCategory(params: CreateStockCategoryParams): Promise<StockCategoryEntity> {
    return StockMapper.toCategory(await this.datasource.createCategory(toCategoryData(params)));
  }

  async createLocation(params: CreateStockLocationParams): Promise<StockLocationEntity> {
    return StockMapper.toLocation(await this.datasource.createLocation(toLocationData(params)));
  }

  async createLocations(params: CreateStockLocationParams[]): Promise<StockLocationEntity[]> {
    const rows = await this.datasource.createLocations(params.map(toLocationData));

    return rows.map((row) => StockMapper.toLocation(row));
  }

  async deleteByOwner(access: OwnerAccess): Promise<void> {
    await this.datasource.deleteByOwner(key(access));
  }

  async deleteCategory(id: string, move?: CatalogMove): Promise<void> {
    await this.datasource.deleteCategory(id, move);
  }

  async deleteLocation(id: string, move?: CatalogMove): Promise<void> {
    await this.datasource.deleteLocation(id, move);
  }

  async findCatalogByOwners(owners: OwnerAccess[]): Promise<{
    categories: StockCategoryEntity[];
    locations: StockLocationEntity[];
    shoppingLists: ShoppingListEntity[];
  }> {
    const { categories, locations, shopping_lists } = await this.datasource.findCatalogByOwners(
      owners.map(key),
    );

    return {
      categories: categories.map((row) => StockMapper.toCategory(row)),
      locations: locations.map((row) => StockMapper.toLocation(row)),
      shoppingLists: shopping_lists.map((row) => ShoppingListMapper.toList(row)),
    };
  }

  async findCategories(access: OwnerAccess): Promise<StockCategoryEntity[]> {
    const rows = await this.datasource.findCategories(key(access));

    return rows.map((row) => StockMapper.toCategory(row));
  }

  async findCategoryById(id: string): Promise<StockCategoryEntity | undefined> {
    const row = await this.datasource.findCategoryById(id);

    return row ? StockMapper.toCategory(row) : undefined;
  }

  async findLocationById(id: string): Promise<StockLocationEntity | undefined> {
    const row = await this.datasource.findLocationById(id);

    return row ? StockMapper.toLocation(row) : undefined;
  }

  async findLocations(access: OwnerAccess): Promise<StockLocationEntity[]> {
    const rows = await this.datasource.findLocations(key(access));

    return rows.map((row) => StockMapper.toLocation(row));
  }

  async setCategoryStatus(ids: string[], status: StockCatalogStatus): Promise<void> {
    await this.datasource.setCategoryStatus(ids, status as AccountStatus);
  }

  async setLocationStatus(ids: string[], status: StockCatalogStatus): Promise<void> {
    await this.datasource.setLocationStatus(ids, status as AccountStatus);
  }

  async updateCategory(params: UpdateStockCategoryParams): Promise<StockCategoryEntity> {
    const row = await this.datasource.updateCategory({
      cascade: params.cascade,
      color: params.color,
      finance_category_id: params.financeCategoryId,
      icon: params.icon,
      id: params.id,
      name: params.name,
      parent_id: params.parentId,
    });

    return StockMapper.toCategory(row);
  }

  async updateLocation(params: UpdateStockLocationParams): Promise<StockLocationEntity> {
    const row = await this.datasource.updateLocation({
      cascade: params.cascade,
      color: params.color,
      icon: params.icon,
      id: params.id,
      name: params.name,
      parent_id: params.parentId,
    });

    return StockMapper.toLocation(row);
  }
}
