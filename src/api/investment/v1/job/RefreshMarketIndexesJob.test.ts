import { MARKET_INDEXES_SCHEDULE, RefreshMarketIndexesJob } from './RefreshMarketIndexesJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const refresh = { execute: jest.fn() };

function job(enabled: boolean): RefreshMarketIndexesJob {
  return new RefreshMarketIndexesJob(
    scheduler,
    logger,
    { marketIndexJobEnabled: enabled } as never,
    refresh as never,
  );
}

beforeEach(() => jest.resetAllMocks());

describe('RefreshMarketIndexesJob', () => {
  it('SHOULD run on weekdays at 19:00 São Paulo time (spec 113 FR 6)', () => {
    job(true).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledWith(
      'market-indexes',
      '0 0 19 * * 1-5',
      'America/Sao_Paulo',
      expect.any(Function),
    );
    expect(MARKET_INDEXES_SCHEDULE.cron).toBe('0 0 19 * * 1-5');
  });

  it('SHOULD refresh every series WHEN the schedule fires', async () => {
    job(true).onModuleInit();

    await scheduler.cron.mock.calls[0][3]();

    expect(refresh.execute).toHaveBeenCalledWith();
  });

  it('SHOULD register nothing WHEN the job is disabled', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'info',
      'Market index job is disabled',
      expect.objectContaining({ module: 'RefreshMarketIndexesJob' }),
    );
  });
});
