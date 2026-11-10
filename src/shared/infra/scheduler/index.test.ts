import { CronJob } from 'cron';

import { Scheduler } from './index';
import { logger, registry, stop } from './index.mocks';

jest.mock('cron', () => ({ CronJob: { from: jest.fn(() => ({ job: true })) } }));

const fromSpy = jest.mocked(CronJob.from);

beforeEach(() => jest.clearAllMocks());

describe('Scheduler', () => {
  it('SHOULD register a started cron job in the time zone', () => {
    new Scheduler(registry, logger).cron(
      'b3-hourly',
      '5 10-17 * * 1-5',
      'America/Sao_Paulo',
      jest.fn(),
    );

    expect(fromSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cronTime: '5 10-17 * * 1-5',
        start: true,
        timeZone: 'America/Sao_Paulo',
      }),
    );
    expect(registry.addCronJob).toHaveBeenCalledWith('b3-hourly', { job: true });
  });

  it('SHOULD log a failing handler without throwing', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    new Scheduler(registry, logger).cron('x', '* * * * *', 'UTC', handler);
    const onTick = (fromSpy.mock.calls[0][0] as unknown as { onTick: () => void }).onTick;

    onTick();
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.log).toHaveBeenCalledWith(
      'error',
      'Scheduled job x failed',
      expect.objectContaining({ error: 'boom' }),
    );
  });

  it('SHOULD stop every job on module destroy', () => {
    new Scheduler(registry, logger).onModuleDestroy();

    expect(stop).toHaveBeenCalled();
  });
});
