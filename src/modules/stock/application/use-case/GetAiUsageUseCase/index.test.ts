import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';

import { GetAiUsageUseCase } from './index';

const repository = { consume: jest.fn(), findDay: jest.fn() };
const env = { llmDailyLightLimit: 50, llmDailySearchLimit: 10, llmUsageTimezone: 'UTC' };

it('SHOULD return the counters next to the limits', async () => {
  repository.findDay.mockResolvedValue({ LIGHT: 41, SEARCH: 8 });
  const module = await Test.createTestingModule({
    providers: [
      GetAiUsageUseCase,
      { provide: 'IAiUsageRepository', useValue: repository },
      { provide: EnvService, useValue: env },
    ],
  }).compile();

  expect(
    await module.get(GetAiUsageUseCase).execute({
      now: new Date('2026-11-23T12:00:00.000Z'),
      userId: 'user-id',
    }),
  ).toEqual({ light: { limit: 50, used: 41 }, search: { limit: 10, used: 8 } });
  expect(repository.findDay).toHaveBeenCalledWith('user-id', '2026-11-23');
});
