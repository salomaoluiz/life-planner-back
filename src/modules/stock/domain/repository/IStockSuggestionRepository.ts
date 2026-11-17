import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockUnits } from '@stock/domain/entity/StockEntity';

export type IStockSuggestionRepository = {
  // Items that still have no embedding (backfill), oldest first.
  findSuggestions(params: {
    embedding?: number[];
    limit?: number;
    ownerAccess: OwnerAccess;
    query: string;
  }): Promise<StockSuggestionRow[]>;
  findWithoutEmbedding(limit: number): Promise<StockEmbeddingTarget[]>;
  // Text sent to the provider: item name and brand only.
  findEmbeddingText(id: string): Promise<string | undefined>;
  setEmbedding(id: string, embedding: number[]): Promise<void>;
};
export interface StockEmbeddingTarget {
  id: string;
  text: string;
}
export interface StockSuggestionRow {
  brand?: string;
  description: string;
  id: string;
  quantity: number;
  trigram: number;
  unit: StockUnits;
  // Cosine distance; absent without an embedding on either side.
  distance?: number;
}
