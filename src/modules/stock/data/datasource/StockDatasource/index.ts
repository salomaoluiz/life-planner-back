import { Injectable } from '@nestjs/common';

import { StockItem } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import { toOwnerWhere } from '@stock/data/datasource/mapper/OwnerWhere';
import {
  CreateStockDatasourceParams,
  ExistsStockDatasourceParams,
  IStockDatasource,
  UpdateStockDatasourceParams,
} from '@stock/data/repository/datasource/IStockDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';

@Injectable()
export class StockDatasource implements IStockDatasource {
  constructor(private readonly db: Database) {}

  async create(params: CreateStockDatasourceParams): Promise<StockItem> {
    return this.db.client.stockItem.create({ data: params });
  }

  async delete(id: string): Promise<void> {
    await this.db.client.stockItem.deleteMany({ where: { id } });
  }

  async exists(params: ExistsStockDatasourceParams): Promise<boolean> {
    const found = await this.db.client.stockItem.findFirst({
      select: { id: true },
      where: { owner: params.owner, owner_id: params.owner_id },
    });

    return found !== null;
  }

  async findById(id: string): Promise<null | StockItem> {
    return this.db.client.stockItem.findUnique({ where: { id } });
  }

  async findByOwners(owners: OwnerAccess[]): Promise<StockItem[]> {
    return this.db.client.stockItem.findMany({ where: toOwnerWhere(owners) });
  }

  async update(params: UpdateStockDatasourceParams): Promise<StockItem> {
    return this.db.client.stockItem.update({
      data: {
        barcode: params.barcode,
        brand: params.brand,
        description: params.description,
        expiration_date: params.expiration_date,
        notes: params.notes,
        opening_date: params.opening_date,
        owner: params.owner,
        owner_id: params.owner_id,
        purchase_date: params.purchase_date,
        quantity: params.quantity,
        unit: params.unit,
      },
      where: { id: params.id },
    });
  }
}
