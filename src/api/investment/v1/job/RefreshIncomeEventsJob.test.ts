import { INCOME_EVENTS_SCHEDULE, RefreshIncomeEventsJob } from './RefreshIncomeEventsJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const refresh = { execute: jest.fn() };

function job(enabled: boolean) {
  return new RefreshIncomeEventsJob(
    scheduler,
    logger,
    { investmentQuotesJobEnabled: enabled } as never,
    refresh as never,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('RefreshIncomeEventsJob', () => {
  it('SHOULD run on weekdays at 19:00 São Paulo time (after the B3 close run)', () => {
    job(true).onModuleInit();

    expect(scheduler.cron).toHaveBeenCalledWith(
      'income-events',
      '0 0 19 * * 1-5',
      'America/Sao_Paulo',
      expect.any(Function),
    );
    expect(INCOME_EVENTS_SCHEDULE.cron).toBe('0 0 19 * * 1-5');
  });

  it('SHOULD refresh the events WHEN the schedule fires', async () => {
    job(true).onModuleInit();

    await scheduler.cron.mock.calls[0][3]();

    expect(refresh.execute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD register nothing WHEN the job is disabled', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});
