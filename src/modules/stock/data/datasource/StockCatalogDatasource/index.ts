import { Injectable } from '@nestjs/common';

import { AccountStatus, StockCategory, StockLocation, StockShoppingList } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import {
  AppearanceCascadeDatasource,
  CatalogMoveDatasource,
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

  // Spec 125 FR 22: the items of the subtree move (set-based) and the subtree goes in ONE transaction.
  async deleteCategory(id: string, move?: CatalogMoveDatasource): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      if (move) {
        await tx.stockItem.updateMany({
          data: { category_id: move.to },
          where: { category_id: { in: move.from } },
        });
      }

      await tx.stockCategory.deleteMany({ where: { id } });
    });
  }

  async deleteLocation(id: string, move?: CatalogMoveDatasource): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      if (move) {
        await tx.stockItem.updateMany({
          data: { location_id: move.to },
          where: { location_id: { in: move.from } },
        });
      }

      await tx.stockLocation.deleteMany({ where: { id } });
    });
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

  async setLocationStatus(ids: string[], status: AccountStatus): Promise<void> {
    await this.db.client.stockLocation.updateMany({ data: { status }, where: { id: { in: ids } } });
  }

  // Spec 125 FR 12: the row and the appearance of its descendants change together.
  private async cascadeAppearance(
    cascade: AppearanceCascadeDatasource | undefined,
    write: (ids: string[], patch: { color?: string; icon?: string }) => Promise<unknown>,
  ): Promise<void> {
    if (!cascade) {
      return;
    }

    if (cascade.icon !== undefined && cascade.ids.length > 0) {
      await write(cascade.ids, { icon: cascade.icon });
    }

    for (const [childId, color] of Object.entries(cascade.colors)) {
      await write([childId], { color });
    }
  }

  async updateCategory(params: UpdateStockCategoryDatasourceParams): Promise<StockCategory> {
    const { cascade, id, ...data } = params;

    return this.db.client.$transaction(async (tx) => {
      const row = await tx.stockCategory.update({ data, where: { id } });

      await this.cascadeAppearance(cascade, async (ids, patch) =>
        tx.stockCategory.updateMany({ data: patch, where: { id: { in: ids } } }),
      );

      return row;
    });
  }

  async updateLocation(params: UpdateStockLocationDatasourceParams): Promise<StockLocation> {
    const { cascade, id, ...data } = params;

    return this.db.client.$transaction(async (tx) => {
      const row = await tx.stockLocation.update({ data, where: { id } });

      await this.cascadeAppearance(cascade, async (ids, patch) =>
        tx.stockLocation.updateMany({ data: patch, where: { id: { in: ids } } }),
      );

      return row;
    });
  }
}
