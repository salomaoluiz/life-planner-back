import { OwnerType } from '@db/client';

export interface IStockSuggestionDatasource {
  findEmbeddingText(id: string): Promise<null | string>;
  findSuggestions(params: {
    embedding?: number[];
    limit: number;
    max_distance: number;
    min_trigram: number;
    owner: OwnerType;
    owner_id: string;
    query: string;
  }): Promise<StockSuggestionDatasourceRow[]>;
  findWithoutEmbedding(limit: number): Promise<{ id: string; text: string }[]>;
  setEmbedding(id: string, embedding: number[]): Promise<void>;
}
export interface StockSuggestionDatasourceRow {
  brand: null | string;
  description: string;
  // pgvector cosine distance, null without an embedding on either side.
  distance: null | number;
  id: string;
  quantity: number;
  trigram: number;
  unit: string;
}
