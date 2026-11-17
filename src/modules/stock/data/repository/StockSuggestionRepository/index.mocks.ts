import { Test } from '@nestjs/testing';

import { StockSuggestionRepository } from './index';

const datasource = {
  findEmbeddingText: jest.fn(),
  findSuggestions: jest.fn(),
  findWithoutEmbedding: jest.fn(),
  setEmbedding: jest.fn(),
};
let setup: StockSuggestionRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      StockSuggestionRepository,
      { provide: 'IStockSuggestionDatasource', useValue: datasource },
    ],
  }).compile();

  setup = module.get(StockSuggestionRepository);
});

export { datasource, setup };
