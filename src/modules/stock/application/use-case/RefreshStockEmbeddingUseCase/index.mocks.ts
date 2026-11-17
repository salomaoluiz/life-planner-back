import {
  build,
  embeddingsMock,
  suggestionRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { RefreshStockEmbeddingUseCase } from './index';

const mocks = { embeddings: embeddingsMock(), suggestions: suggestionRepositoryMock() };
let setup: RefreshStockEmbeddingUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.suggestions.findEmbeddingText.mockResolvedValue('Milk Brand');
  mocks.embeddings.embed.mockResolvedValue([0.1, 0.2]);
  setup = await build(RefreshStockEmbeddingUseCase, [
    { provide: 'IStockSuggestionRepository', useValue: mocks.suggestions },
    { provide: 'IEmbeddings', useValue: mocks.embeddings },
  ]);
});

export { mocks, setup };
