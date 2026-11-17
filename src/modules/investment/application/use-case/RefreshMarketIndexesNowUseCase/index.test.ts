import { HttpException } from '@nestjs/common';

import { setup, spies } from './index.mocks';

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-11-16T12:00:00Z'));
  spies.cooldown = 60000;
});
afterEach(() => {
  jest.useRealTimers();
});

describe('RefreshMarketIndexesNowUseCase', () => {
  it('SHOULD refresh only the stale or missing series', async () => {
    await (await setup()).execute({ userId: 'user-1' });

    expect(spies.refresh).toHaveBeenCalledWith({ onlyStale: true });
  });

  it('SHOULD answer 429 WHEN the same user refreshes twice within a minute, then allow it later', async () => {
    const useCase = await setup();

    await useCase.execute({ userId: 'user-1' });

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toMatchObject({
      response: { code: 'REFRESH_TOO_SOON', message: 'Wait 1 minute to refresh again' },
      status: 429,
    });
    await expect(useCase.execute({ userId: 'user-1' })).rejects.toBeInstanceOf(HttpException);
    expect(spies.refresh).toHaveBeenCalledTimes(1);

    await useCase.execute({ userId: 'user-2' });
    jest.setSystemTime(new Date('2026-11-16T12:01:01Z'));
    await useCase.execute({ userId: 'user-1' });

    expect(spies.refresh).toHaveBeenCalledTimes(3);
  });
});
