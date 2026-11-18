import {
  accessibleOwners,
  build,
  embeddingsMock,
  suggestionRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { SuggestStockItemsUseCase } from './index';

const mocks = {
  accessibleOwners,
  embeddings: embeddingsMock(),
  suggestions: suggestionRepositoryMock(),
};
let setup: SuggestStockItemsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.embeddings.embed.mockResolvedValue(null);
  mocks.suggestions.findSuggestions.mockResolvedValue([]);
  setup = await build(SuggestStockItemsUseCase, [
    { provide: 'IStockSuggestionRepository', useValue: mocks.suggestions },
    { provide: 'IEmbeddings', useValue: mocks.embeddings },
  ]);
});

export { mocks, setup };
