import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { QuoteSourceLimitError, QuoteSourceUnavailableError } from '@shared/infra/quotes/types';

import { mocks, setup, spies } from './index.mocks';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T22:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('SHOULD upsert the events by a stable key AND suggest the ones the position allows', async () => {
  expect(await setup.execute()).toEqual({ created: 1, fetched: 1, skipped: false });

  expect(spies.incomes.upsertEvents).toHaveBeenCalledWith([
    expect.objectContaining({
      amountPerUnit: '0.47',
      eventKey: 'brapi:ITSA4:DIVIDEND:2026-11-21',
      market: QuoteMarket.B3,
      source: 'brapi',
      ticker: 'ITSA4',
    }),
  ]);
  expect(spies.incomes.createSuggestions).toHaveBeenCalledWith([
    { assetId: 'asset-1', eventId: 'ev-1', quantity: '300' },
  ]);
  expect(spies.incomes.runExclusive).toHaveBeenCalledWith(107001, expect.any(Function));
});

it('SHOULD fetch US symbols through Finnhub', async () => {
  spies.quotes.findTrackedSymbols.mockResolvedValue([
    { fetchedAt: null, market: QuoteMarket.US, ticker: 'AAPL' },
  ]);
  spies.finnhub.getIncomeEvents.mockResolvedValue([
    { ...mocks.brapiEvent, currency: 'USD', ticker: 'AAPL' },
  ]);

  await setup.execute();

  expect(spies.brapi.getIncomeEvents).not.toHaveBeenCalled();
  expect(spies.incomes.upsertEvents).toHaveBeenCalledWith([
    expect.objectContaining({ eventKey: 'finnhub:AAPL:DIVIDEND:2026-11-21', source: 'finnhub' }),
  ]);
});

it('SHOULD skip an asset with no BUY and an event before its position existed', async () => {
  spies.incomes.findSuggestionInputs.mockResolvedValue({
    assets: [{ assetId: 'asset-1', market: QuoteMarket.B3, operations: [], ticker: 'ITSA4' }],
    existing: [],
    incomes: [],
  });
  spies.incomes.createSuggestions.mockResolvedValue(0);

  expect((await setup.execute()).created).toBe(0);
  expect(spies.incomes.createSuggestions).toHaveBeenCalledWith([]);
});

it('SHOULD keep the stored events AND log once WHEN a source fails, without the ticker', async () => {
  spies.quotes.findTrackedSymbols.mockResolvedValue([
    ...mocks.tracked,
    { fetchedAt: null, market: QuoteMarket.B3, ticker: 'VALE3' },
  ]);
  spies.brapi.getIncomeEvents.mockRejectedValue(new QuoteSourceLimitError('429'));

  await setup.execute();

  expect(spies.brapi.getIncomeEvents).toHaveBeenCalledTimes(1);
  expect(spies.logger.log).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(spies.logger.log.mock.calls)).not.toContain('ITSA4');
  expect(spies.incomes.upsertEvents).toHaveBeenCalledWith([]);
  expect(spies.incomes.createSuggestions).toHaveBeenCalled();
});

it('SHOULD give no events, silently, WHEN the source has no token', async () => {
  spies.brapi.getIncomeEvents.mockRejectedValue(new QuoteSourceUnavailableError('brapi'));

  await setup.execute();

  expect(spies.logger.log).not.toHaveBeenCalled();
});

it('SHOULD do nothing WHEN another instance holds the lock', async () => {
  spies.incomes.runExclusive.mockResolvedValue(false);

  expect(await setup.execute()).toEqual({ created: 0, fetched: 0, skipped: true });
  expect(spies.brapi.getIncomeEvents).not.toHaveBeenCalled();
});
