import { Inject, Injectable } from '@nestjs/common';

import { StockMapper } from '@stock/data/datasource/mapper/StockMapper';
import { IStockDatasource } from '@stock/data/repository/datasource/IStockDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import {
  CreateStockRepositoryParams,
  IStockRepository,
  UpdateStockRepositoryParams,
} from '@stock/domain/repository';

@Injectable()
export class StockRepository implements IStockRepository {
  constructor(
    @Inject('IStockDatasource')
    private readonly stockDatasource: IStockDatasource,
  ) {}

  async create(params: CreateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.create({
      barcode: params.barcode,
      brand: params.brand,
      description: params.description,
      expiration_date: params.expirationDate,
      notes: params.notes,
      opening_date: params.openingDate,
      owner: params.owner,
      owner_id: params.ownerId,
      purchase_date: params.purchaseDate,
      quantity: params.quantity,
      unit: params.unit,
    });

    return StockMapper.toDomain(result);
  }

  async delete(id: string): Promise<void> {
    await this.stockDatasource.delete(id);
  }

  async existsByOwner(access: OwnerAccess): Promise<boolean> {
    return this.stockDatasource.exists({ owner: access.owner, owner_id: access.ownerId });
  }

  async findById(id: string): Promise<StockEntity | undefined> {
    const result = await this.stockDatasource.findById(id);

    return result ? StockMapper.toDomain(result) : undefined;
  }

  async findByOwners(owners: OwnerAccess[]): Promise<StockEntity[]> {
    const result = await this.stockDatasource.findByOwners(owners);

    return result.map((row) => StockMapper.toDomain(row));
  }

  async update(params: UpdateStockRepositoryParams): Promise<StockEntity> {
    const result = await this.stockDatasource.update({
      barcode: params.barcode,
      brand: params.brand,
      description: params.description,
      expiration_date: params.expirationDate,
      id: params.id,
      notes: params.notes,
      opening_date: params.openingDate,
      owner: params.owner,
      owner_id: params.ownerId,
      purchase_date: params.purchaseDate,
      quantity: params.quantity,
      unit: params.unit,
    });

    return StockMapper.toDomain(result);
  }
}
