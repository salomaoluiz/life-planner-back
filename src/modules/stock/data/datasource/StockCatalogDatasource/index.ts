import { Injectable } from '@nestjs/common';

import { AccountStatus, StockCategory, StockLocation, StockShoppingList } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import {
  CreateStockCategoryDatasourceParams,
  CreateStockLocationDatasourceParams,
  IStockCatalogDatasource,
  OwnerKey,
  UpdateStockCategoryDatasourceParams,
  UpdateStockLocationDatasourceParams,
} from '@stock/data/repository/datasource/IStockCatalogDatasource';

@Injectable()
export class StockCatalogDatasource implements IStockCatalogDatasource {
  constructor(private readonly db: Database) {}

  async countItemsByCategory(key: OwnerKey): Promise<{ category_id: string; count: number }[]> {
    const groups = await this.db.client.stockItem.groupBy({
      _count: { _all: true },
      by: ['category_id'],
      where: { ...key, category_id: { not: null } },
    });

    return groups.map((group) => ({
      category_id: group.category_id as string,
      count: group._count._all,
    }));
  }

  async countItemsByLocation(key: OwnerKey): Promise<{ count: number; location_id: string }[]> {
    const groups = await this.db.client.stockItem.groupBy({
      _count: { _all: true },
      by: ['location_id'],
      where: { ...key, location_id: { not: null } },
    });

    return groups.map((group) => ({
      count: group._count._all,
      location_id: group.location_id as string,
    }));
  }

  async createCategories(params: CreateStockCategoryDatasourceParams[]): Promise<StockCategory[]> {
    return this.db.client.$transaction(async (tx) => {
      const created: StockCategory[] = [];

      for (const data of params) {
        created.push(await tx.stockCategory.create({ data }));
      }

      return created;
    });
  }

  async createCategory(params: CreateStockCategoryDatasourceParams): Promise<StockCategory> {
    return this.db.client.stockCategory.create({ data: params });
  }

  async createLocation(params: CreateStockLocationDatasourceParams): Promise<StockLocation> {
    return this.db.client.stockLocation.create({ data: params });
  }

  async createLocations(params: CreateStockLocationDatasourceParams[]): Promise<StockLocation[]> {
    return this.db.client.$transaction(async (tx) => {
      const created: StockLocation[] = [];

      for (const data of params) {
        created.push(await tx.stockLocation.create({ data }));
      }

      return created;
    });
  }

  async deleteByOwner(key: OwnerKey): Promise<void> {
    await this.db.client.$transaction([
      this.db.client.stockCategory.deleteMany({ where: key }),
      this.db.client.stockLocation.deleteMany({ where: key }),
    ]);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.client.stockCategory.deleteMany({ where: { id } });
  }

  async deleteLocation(id: string): Promise<void> {
    await this.db.client.stockLocation.deleteMany({ where: { id } });
  }

  async findCatalogByOwners(keys: OwnerKey[]): Promise<{
    categories: StockCategory[];
    locations: StockLocation[];
    shopping_lists: StockShoppingList[];
  }> {
    const where = { OR: keys };
    const [categories, locations, shoppingLists] = await Promise.all([
      this.db.client.stockCategory.findMany({ orderBy: { name: 'asc' }, where }),
      this.db.client.stockLocation.findMany({ orderBy: { name: 'asc' }, where }),
      // Spec 118: the active lists, so item views resolve their effective list without another round trip.
      this.db.client.stockShoppingList.findMany({
        orderBy: { name: 'asc' },
        where: { ...where, status: 'ACTIVE' },
      }),
    ]);

    return { categories, locations, shopping_lists: shoppingLists };
  }

  async findCategories(key: OwnerKey): Promise<StockCategory[]> {
    return this.db.client.stockCategory.findMany({ orderBy: { name: 'asc' }, where: key });
  }

  async findCategoryById(id: string): Promise<null | StockCategory> {
    return this.db.client.stockCategory.findUnique({ where: { id } });
  }

  async findLocationById(id: string): Promise<null | StockLocation> {
    return this.db.client.stockLocation.findUnique({ where: { id } });
  }

  async findLocations(key: OwnerKey): Promise<StockLocation[]> {
    return this.db.client.stockLocation.findMany({ orderBy: { name: 'asc' }, where: key });
  }

  async setCategoryStatus(ids: string[], status: AccountStatus): Promise<void> {
    await this.db.client.stockCategory.updateMany({ data: { status }, where: { id: { in: ids } } });
  }

  async updateCategory(params: UpdateStockCategoryDatasourceParams): Promise<StockCategory> {
    const { id, ...data } = params;

    return this.db.client.stockCategory.update({ data, where: { id } });
  }

  async updateLocation(params: UpdateStockLocationDatasourceParams): Promise<StockLocation> {
    const { id, ...data } = params;

    return this.db.client.stockLocation.update({ data, where: { id } });
  }
}
