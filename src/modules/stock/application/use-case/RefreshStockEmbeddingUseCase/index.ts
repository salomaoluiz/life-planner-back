import { Inject } from '@nestjs/common';
import { z } from 'zod';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IEmbeddings } from '@shared/infra/embeddings';
import { validate } from '@shared/infra/validation';
import { IStockSuggestionRepository } from '@stock/domain/repository';

const RefreshStockEmbeddingSchema = z.object({ id: z.string().min(1) });

export type RefreshStockEmbeddingInput = z.input<typeof RefreshStockEmbeddingSchema>;

// Spec 116 FR 31: runs after the write, never inside it. Without a vector (no key, timeout, error) the column stays
// null and a later update or the backfill retries. Only the item name and brand reach the provider (FR 33).
export class RefreshStockEmbeddingUseCase implements UseCaseWithParams<
  RefreshStockEmbeddingInput,
  boolean
> {
  constructor(
    @Inject('IStockSuggestionRepository')
    private readonly suggestionRepository: IStockSuggestionRepository,
    @Inject('IEmbeddings')
    private readonly embeddings: IEmbeddings,
  ) {}

  async execute(params: RefreshStockEmbeddingInput): Promise<boolean> {
    const input = validate(RefreshStockEmbeddingSchema, params);
    const text = await this.suggestionRepository.findEmbeddingText(input.id);

    if (!text) {
      return false;
    }

    const vector = await this.embeddings.embed(text, { timeoutMs: 5000 });

    if (!vector) {
      return false;
    }

    await this.suggestionRepository.setEmbedding(input.id, vector);

    return true;
  }
}
