import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';

import { ConsumeAiUsageUseCase } from './index';

const repository = { consume: jest.fn(), findDay: jest.fn() };
const env = {
  llmDailyLightLimit: 50,
  llmDailySearchLimit: 10,
  llmUsageTimezone: 'America/Sao_Paulo',
};
let setup: ConsumeAiUsageUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [
      ConsumeAiUsageUseCase,
      { provide: 'IAiUsageRepository', useValue: repository },
      { provide: EnvService, useValue: env },
    ],
  }).compile();

  setup = module.get(ConsumeAiUsageUseCase);
});

it('SHOULD consume against the kind limit and the São Paulo day AND allow the call', async () => {
  repository.consume.mockResolvedValue(3);

  const allowed = await setup.execute({
    kind: 'SEARCH',
    now: new Date('2026-11-24T01:30:00.000Z'),
    userId: 'user-id',
  });

  expect(allowed).toBe(true);
  expect(repository.consume).toHaveBeenCalledWith('user-id', 'SEARCH', '2026-11-23', 10);
});

it('SHOULD refuse the call WHEN the limit was reached', async () => {
  repository.consume.mockResolvedValue(undefined);

  expect(await setup.execute({ kind: 'LIGHT', userId: 'user-id' })).toBe(false);
  expect(repository.consume).toHaveBeenCalledWith('user-id', 'LIGHT', expect.any(String), 50);
});
