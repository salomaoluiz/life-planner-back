import { INCOME_EVENTS_SCHEDULE, RefreshIncomeEventsJob } from './RefreshIncomeEventsJob';

const scheduler = { cron: jest.fn() };
const logger = { log: jest.fn() };
const refresh = { execute: jest.fn() };
const refreshCorporate = { execute: jest.fn() };

function job(enabled: boolean) {
  return new RefreshIncomeEventsJob(
    scheduler,
    logger,
    { investmentQuotesJobEnabled: enabled } as never,
    refresh as never,
    refreshCorporate as never,
  );
}

beforeEach(() => jest.resetAllMocks());

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

  it('SHOULD refresh the corporate events right after the income events (spec 108 FR 22)', async () => {
    const order: string[] = [];
    refresh.execute.mockImplementation(async () => order.push('income'));
    refreshCorporate.execute.mockImplementation(async () => order.push('corporate'));
    job(true).onModuleInit();

    await scheduler.cron.mock.calls[0][3]();

    expect(order).toEqual(['income', 'corporate']);
  });

  it('SHOULD still refresh the corporate events WHEN the income step fails, then report the failure', async () => {
    refresh.execute.mockRejectedValue(new Error('income source down'));
    job(true).onModuleInit();

    await expect(scheduler.cron.mock.calls[0][3]()).rejects.toThrow('income source down');

    expect(refreshCorporate.execute).toHaveBeenCalledTimes(1);
  });

  it('SHOULD report the corporate step failure WHEN the income step worked', async () => {
    refreshCorporate.execute.mockRejectedValue(new Error('events source down'));
    job(true).onModuleInit();

    await expect(scheduler.cron.mock.calls[0][3]()).rejects.toThrow('events source down');
  });

  it('SHOULD register nothing WHEN the job is disabled', () => {
    job(false).onModuleInit();

    expect(scheduler.cron).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
  });
});
