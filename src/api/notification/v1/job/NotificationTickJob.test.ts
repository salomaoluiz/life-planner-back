import {
  NOTIFICATION_LOCK_KEY,
  NOTIFICATION_TICK_NAME,
  NotificationTickJob,
  tickCron,
} from './NotificationTickJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const database = { withAdvisoryLock: jest.fn() };
const tick = { run: jest.fn() };

async function fire() {
  await scheduler.cron.mock.calls[0][3]();
}
function job(enabled: boolean, minutes = 15) {
  return new NotificationTickJob(
    scheduler,
    logger,
    { notificationJobEnabled: enabled, notificationTickMinutes: minutes } as never,
    database as never,
    tick as never,
  );
}

beforeEach(() => jest.resetAllMocks());

describe('tickCron', () => {
  it.each([
    [1, '0 */1 * * * *'],
    [15, '0 */15 * * * *'],
    [30, '0 */30 * * * *'],
    [60, '0 0 * * * *'],
  ])('SHOULD build the UTC cron for %i minutes', (minutes, expected) => {
    expect(tickCron(minutes)).toBe(expected);
  });
});

describe('NotificationTickJob', () => {
  it('SHOULD schedule the tick every N minutes in UTC', () => {
    job(true, 10).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledWith(
      NOTIFICATION_TICK_NAME,
      '0 */10 * * * *',
      'UTC',
      expect.any(Function),
    );
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('SHOULD log that it is disabled AND schedule nothing WHEN NOTIFICATION_JOB_ENABLED=false', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('info', 'Notification tick job is disabled', {
      module: 'NotificationTickJob',
    });
  });

  it('SHOULD run the tick under the advisory lock', async () => {
    database.withAdvisoryLock.mockImplementation(
      async (_key: number, work: () => Promise<void>) => {
        await work();

        return true;
      },
    );
    job(true).onModuleInit();

    await fire();

    expect(database.withAdvisoryLock).toHaveBeenCalledWith(
      NOTIFICATION_LOCK_KEY,
      expect.any(Function),
    );
    expect(tick.run).toHaveBeenCalledWith(expect.any(Date));
  });

  it('SHOULD return at once WHEN another instance holds the lock (no double run)', async () => {
    database.withAdvisoryLock.mockResolvedValue(false);
    job(true).onModuleInit();

    await fire();

    expect(tick.run).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('info', expect.stringContaining('another instance'), {
      module: 'NotificationTickJob',
    });
  });
});
