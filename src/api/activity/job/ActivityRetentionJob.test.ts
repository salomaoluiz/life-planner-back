import {
  ACTIVITY_RETENTION_CRON,
  ACTIVITY_RETENTION_LOCK_KEY,
  ACTIVITY_RETENTION_NAME,
  ActivityRetentionJob,
} from './ActivityRetentionJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const database = { withAdvisoryLock: jest.fn() };
const cleanup = { execute: jest.fn() };

async function fire() {
  await scheduler.cron.mock.calls[0][3]();
}
function job(enabled: boolean) {
  return new ActivityRetentionJob(
    scheduler,
    logger,
    { activityRetentionDays: 183, activityRetentionJobEnabled: enabled } as never,
    database as never,
    cleanup as never,
  );
}

beforeEach(() => jest.resetAllMocks());

describe('ActivityRetentionJob', () => {
  it('SHOULD schedule the daily purge in UTC', () => {
    job(true).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledWith(
      ACTIVITY_RETENTION_NAME,
      ACTIVITY_RETENTION_CRON,
      'UTC',
      expect.any(Function),
    );
  });

  it('SHOULD log AND schedule nothing WHEN ACTIVITY_RETENTION_JOB_ENABLED=false', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('info', 'Activity retention job is disabled', {
      module: 'ActivityRetentionJob',
    });
  });

  it('SHOULD purge under the advisory lock with the retention days', async () => {
    database.withAdvisoryLock.mockImplementation(async (_key, work) => {
      await work();

      return true;
    });
    cleanup.execute.mockResolvedValue(4);
    job(true).onModuleInit();

    await fire();

    expect(database.withAdvisoryLock).toHaveBeenCalledWith(
      ACTIVITY_RETENTION_LOCK_KEY,
      expect.any(Function),
    );
    expect(cleanup.execute).toHaveBeenCalledWith({ retentionDays: 183 });
  });

  it('SHOULD log a skip WHEN another instance holds the lock', async () => {
    database.withAdvisoryLock.mockResolvedValue(false);
    job(true).onModuleInit();

    await fire();

    expect(cleanup.execute).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'info',
      'Activity retention skipped: another instance holds the lock',
      { module: 'ActivityRetentionJob' },
    );
  });
});
