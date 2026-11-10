import { RefreshQuotesJob, SCHEDULES } from './RefreshQuotesJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const refresh = { execute: jest.fn() };

function job(enabled: boolean) {
  return new RefreshQuotesJob(
    scheduler,
    logger,
    { investmentQuotesJobEnabled: enabled } as never,
    refresh as never,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('RefreshQuotesJob', () => {
  it('SHOULD register the B3, US and USD-BRL schedules in their time zones', () => {
    job(true).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledTimes(SCHEDULES.length);
    expect(scheduler.cron).toHaveBeenCalledWith(
      'quotes-b3-hourly',
      '0 5 10-17 * * 1-5',
      'America/Sao_Paulo',
      expect.any(Function),
    );
    expect(scheduler.cron).toHaveBeenCalledWith(
      'quotes-us-close',
      '0 45 16 * * 1-5',
      'America/New_York',
      expect.any(Function),
    );
    expect(scheduler.cron).toHaveBeenCalledWith(
      'quotes-fx-close',
      '0 30 18 * * 1-5',
      'America/Sao_Paulo',
      expect.any(Function),
    );
  });

  it('SHOULD run the refresh use case with the target and close flag of each schedule', async () => {
    job(true).onModuleInit();

    const closeCall = scheduler.cron.mock.calls.find(([name]) => name === 'quotes-b3-close');
    await closeCall?.[3]();
    const hourlyCall = scheduler.cron.mock.calls.find(([name]) => name === 'quotes-us-hourly');
    await hourlyCall?.[3]();

    expect(refresh.execute).toHaveBeenNthCalledWith(1, { closeRun: true, target: 'B3' });
    expect(refresh.execute).toHaveBeenNthCalledWith(2, { closeRun: false, target: 'US' });
  });

  it('SHOULD register nothing WHEN INVESTMENT_QUOTES_JOB_ENABLED is false', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('info', expect.any(String), expect.any(Object));
  });
});
