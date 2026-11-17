import {
  build,
  embeddingsMock,
  suggestionRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { BackfillStockEmbeddingsUseCase } from './index';

const mocks = { embeddings: embeddingsMock(), suggestions: suggestionRepositoryMock() };
let setup: BackfillStockEmbeddingsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(BackfillStockEmbeddingsUseCase, [
    { provide: 'IStockSuggestionRepository', useValue: mocks.suggestions },
    { provide: 'IEmbeddings', useValue: mocks.embeddings },
  ]);
});

export { mocks, setup };
