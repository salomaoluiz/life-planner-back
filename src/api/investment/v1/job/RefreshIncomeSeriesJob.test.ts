import { INCOME_SERIES_SCHEDULE, RefreshIncomeSeriesJob } from './RefreshIncomeSeriesJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const refresh = { execute: jest.fn() };

function job(enabled: boolean): RefreshIncomeSeriesJob {
  return new RefreshIncomeSeriesJob(
    scheduler,
    logger,
    { investmentIncomeSeriesJobEnabled: enabled } as never,
    refresh as never,
  );
}

beforeEach(() => jest.resetAllMocks());

describe('RefreshIncomeSeriesJob', () => {
  it('SHOULD run on day 1 of every month at 00:10 São Paulo time (spec 115 FR 18)', () => {
    job(true).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledWith(
      'income-series',
      '0 10 0 1 * *',
      'America/Sao_Paulo',
      expect.any(Function),
    );
    expect(INCOME_SERIES_SCHEDULE.cron).toBe('0 10 0 1 * *');
  });

  it('SHOULD materialize the series WHEN the schedule fires', async () => {
    job(true).onModuleInit();

    await scheduler.cron.mock.calls[0][3]();

    expect(refresh.execute).toHaveBeenCalledWith();
  });

  it('SHOULD register nothing WHEN the job is disabled', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      'info',
      'Income series job is disabled',
      expect.objectContaining({ module: 'RefreshIncomeSeriesJob' }),
    );
  });
});
