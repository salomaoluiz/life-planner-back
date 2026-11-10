import { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { quoteProviders } from '@investment/application/service/QuoteContext/index.mocks';

import { repositorySpies } from './investment.fixture';

// Builds a use case of spec 105 with the repository as jest spies and the quote loader as an inert mock.
export async function buildUseCase<T>(
  useCase: Type<T>,
  spies: ReturnType<typeof repositorySpies>,
): Promise<T> {
  const module = await Test.createTestingModule({
    providers: [useCase, { provide: 'IInvestmentRepository', useValue: spies }, ...quoteProviders],
  }).compile();

  return module.get(useCase);
}
