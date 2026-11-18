import { Inject } from '@nestjs/common';

import { UseCase } from '@shared/application/use-case/types';
import { IEmbeddings } from '@shared/infra/embeddings';
import { IStockSuggestionRepository } from '@stock/domain/repository';

const BATCH_SIZE = 50;

// `yarn stock:embeddings:backfill`: fills the items that still have no embedding. A batch where no item got a
// vector (provider off or down) ends the run, so it never loops on the same rows.
export class BackfillStockEmbeddingsUseCase implements UseCase<{
  failed: number;
  processed: number;
}> {
  constructor(
    @Inject('IStockSuggestionRepository')
    private readonly suggestionRepository: IStockSuggestionRepository,
    @Inject('IEmbeddings')
    private readonly embeddings: IEmbeddings,
  ) {}

  async execute(): Promise<{ failed: number; processed: number }> {
    let processed = 0;
    let failed = 0;
    const seen = new Set<string>();

    for (;;) {
      const batch = (
        await this.suggestionRepository.findWithoutEmbedding(BATCH_SIZE + seen.size)
      ).filter((target) => !seen.has(target.id));
      let embedded = 0;

      for (const target of batch.slice(0, BATCH_SIZE)) {
        seen.add(target.id);

        const vector = await this.embeddings.embed(target.text, { timeoutMs: 10000 });

        if (vector) {
          await this.suggestionRepository.setEmbedding(target.id, vector);
          embedded += 1;
          processed += 1;
        } else {
          failed += 1;
        }
      }

      if (embedded === 0) {
        return { failed, processed };
      }
    }
  }
}
