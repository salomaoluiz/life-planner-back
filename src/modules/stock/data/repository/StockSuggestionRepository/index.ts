import { Inject, Injectable } from '@nestjs/common';

import { IStockSuggestionDatasource } from '@stock/data/repository/datasource/IStockSuggestionDatasource';
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import {
  IStockSuggestionRepository,
  StockEmbeddingTarget,
  StockSuggestionRow,
} from '@stock/domain/repository';
import {
  COSINE_DISTANCE_WEIGHT,
  COSINE_THRESHOLD,
  TRIGRAM_THRESHOLD,
} from '@stock/domain/service/StockSuggestionScore';

@Injectable()
export class StockSuggestionRepository implements IStockSuggestionRepository {
  constructor(
    @Inject('IStockSuggestionDatasource')
    private readonly datasource: IStockSuggestionDatasource,
  ) {}

  async findEmbeddingText(id: string): Promise<string | undefined> {
    return (await this.datasource.findEmbeddingText(id)) ?? undefined;
  }

  async findSuggestions(params: {
    embedding?: number[];
    limit?: number;
    ownerAccess: OwnerAccess;
    query: string;
  }): Promise<StockSuggestionRow[]> {
    const rows = await this.datasource.findSuggestions({
      embedding: params.embedding,
      limit: params.limit ?? 8,
      // 1 - distance * weight >= COSINE_THRESHOLD  <=>  distance <= (1 - COSINE_THRESHOLD) / weight
      max_distance: (1 - COSINE_THRESHOLD) / COSINE_DISTANCE_WEIGHT,
      min_trigram: TRIGRAM_THRESHOLD,
      owner: params.ownerAccess.owner,
      owner_id: params.ownerAccess.ownerId,
      query: params.query,
    });

    return rows.map((row) => ({
      brand: row.brand ?? undefined,
      description: row.description,
      distance: row.distance ?? undefined,
      id: row.id,
      quantity: row.quantity,
      trigram: row.trigram,
      unit: row.unit as StockUnits,
    }));
  }

  async findWithoutEmbedding(limit: number): Promise<StockEmbeddingTarget[]> {
    return this.datasource.findWithoutEmbedding(limit);
  }

  async setEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.datasource.setEmbedding(id, embedding);
  }
}
