import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IEmbeddings } from '@shared/infra/embeddings';
import { validate } from '@shared/infra/validation';
import {
  SUGGESTION_LIMIT,
  SuggestStockItemsInput,
  SuggestStockItemsSchema,
} from '@stock/application/dto/SuggestStockItems';
import { hasOwnerAccess, narrowOwners } from '@stock/domain/entity/OwnerAccess';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { IStockSuggestionRepository } from '@stock/domain/repository';
import { passesThreshold, suggestionScore } from '@stock/domain/service/StockSuggestionScore';

export interface StockSuggestion {
  brand?: string;
  description: string;
  id: string;
  quantity: number;
  score: number;
  unit: StockUnits;
}

// Spec 116 FR 28-33: the owner's items ranked by trigram similarity and, when the provider answers in time,
// by embedding distance. Without a key, on timeout or on error it is trigram only.
export class SuggestStockItemsUseCase implements UseCaseWithParams<
  SuggestStockItemsInput,
  StockSuggestion[]
> {
  constructor(
    @Inject('IStockSuggestionRepository')
    private readonly suggestionRepository: IStockSuggestionRepository,
    @Inject('IEmbeddings')
    private readonly embeddings: IEmbeddings,
  ) {}

  async execute(params: SuggestStockItemsInput): Promise<StockSuggestion[]> {
    const input = validate(SuggestStockItemsSchema, params);
    // Never another owner's items: an owner the caller cannot access has none to suggest.
    const owners =
      input.owner === undefined || input.ownerId === undefined
        ? narrowOwners(input.accessibleOwners).map(({ owner, ownerId }) => ({ owner, ownerId }))
        : [{ owner: input.owner, ownerId: input.ownerId }].filter((target) =>
            hasOwnerAccess(input.accessibleOwners, target),
          );

    if (owners.length === 0) {
      return [];
    }

    const embedding = (await this.embeddings.embed(input.q)) ?? undefined;
    const rows = (
      await Promise.all(
        owners.map(async (ownerAccess) =>
          this.suggestionRepository.findSuggestions({
            embedding,
            limit: SUGGESTION_LIMIT,
            ownerAccess,
            query: input.q,
          }),
        ),
      )
    ).flat();

    return rows
      .filter((row) => passesThreshold(row))
      .map((row) => ({
        brand: row.brand,
        description: row.description,
        id: row.id,
        quantity: row.quantity,
        score: suggestionScore(row),
        unit: row.unit,
      }))
      .sort((a, b) => b.score - a.score || a.description.localeCompare(b.description))
      .slice(0, SUGGESTION_LIMIT);
  }
}
