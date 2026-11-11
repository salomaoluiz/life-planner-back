import { InvestmentOperationType } from '@investment/domain/enum';
import { QuoteMarket } from '@investment/domain/enum/QuoteMarket';
import { Decimal8 } from '@shared/infra/decimal';
import { QuoteSourceLimitError, QuoteSourceUnavailableError } from '@shared/infra/quotes/types';

import { inputsOf, mocks, setup, spies } from './index.mocks';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-19T22:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('SHOULD upsert the events by a stable key AND suggest the ones the position allows', async () => {
  expect(await setup.execute()).toEqual({ created: 1, fetched: 1, skipped: false });

  expect(spies.events.upsertEvents).toHaveBeenCalledWith([
    expect.objectContaining({
      bonusPercent: '10',
      bonusUnitCost: null,
      eventKey: 'brapi:MGLU3:BONUS:2026-11-18',
      market: QuoteMarket.B3,
      ratioFrom: null,
      recordDate: '2026-11-18',
      source: 'brapi',
      ticker: 'MGLU3',
      type: 'BONUS',
    }),
  ]);
  expect(spies.events.createSuggestions).toHaveBeenCalledWith([
    { assetId: 'asset-1', eventId: 'ev-1', quantity: '315' },
  ]);
  expect(spies.events.runExclusive).toHaveBeenCalledWith(108001, expect.any(Function));
});

it('SHOULD fetch US symbols through Finnhub', async () => {
  spies.quotes.findTrackedSymbols.mockResolvedValue([
    { fetchedAt: null, market: QuoteMarket.US, ticker: 'AAPL' },
  ]);
  spies.finnhub.getCorporateEvents.mockResolvedValue([
    {
      currency: 'USD',
      ratioFrom: '1',
      ratioTo: '4',
      recordDate: '2026-08-24',
      ticker: 'AAPL',
      type: 'SPLIT',
    },
  ]);

  await setup.execute();

  expect(spies.brapi.getCorporateEvents).not.toHaveBeenCalled();
  expect(spies.events.upsertEvents).toHaveBeenCalledWith([
    expect.objectContaining({
      eventKey: 'finnhub:AAPL:SPLIT:2026-08-24',
      ratioFrom: '1',
      ratioTo: '4',
      source: 'finnhub',
    }),
  ]);
});

it('SHOULD not suggest a data-com that is today or later', async () => {
  spies.events.findEvents.mockResolvedValue([{ ...mocks.event, recordDate: '2026-11-19' }]);
  spies.events.createSuggestions.mockResolvedValue(0);

  await setup.execute();

  expect(spies.events.createSuggestions).toHaveBeenCalledWith([]);
});

it('SHOULD not suggest an event the owner already entered by hand within 3 days', async () => {
  spies.events.findSuggestionInputs.mockResolvedValue(
    inputsOf([
      mocks.buy,
      {
        createdAt: new Date('2026-11-20T00:00:00Z'),
        date: '2026-11-20',
        event: { kind: 'BONUS', percent: Decimal8.parse('10'), unitCost: null },
        id: 'op-2',
        quantity: Decimal8.zero(),
        total: 0,
        type: InvestmentOperationType.BONUS,
      },
    ]),
  );
  spies.events.createSuggestions.mockResolvedValue(0);

  await setup.execute();

  expect(spies.events.createSuggestions).toHaveBeenCalledWith([]);
});

it('SHOULD skip an existing suggestion in any state', async () => {
  spies.events.findSuggestionInputs.mockResolvedValue({
    ...inputsOf([mocks.buy]),
    existing: ['asset-1:ev-1'],
  });
  spies.events.createSuggestions.mockResolvedValue(0);

  await setup.execute();

  expect(spies.events.createSuggestions).toHaveBeenCalledWith([]);
});

it('SHOULD log a failing source once AND keep going with the stored events', async () => {
  spies.quotes.findTrackedSymbols.mockResolvedValue([
    { fetchedAt: null, market: QuoteMarket.B3, ticker: 'MGLU3' },
    { fetchedAt: null, market: QuoteMarket.B3, ticker: 'ITSA4' },
  ]);
  spies.brapi.getCorporateEvents.mockRejectedValue(new QuoteSourceLimitError('limit'));

  const result = await setup.execute();

  expect(result.fetched).toBe(0);
  expect(spies.brapi.getCorporateEvents).toHaveBeenCalledTimes(1);
  expect(spies.logger.log).toHaveBeenCalledTimes(1);
  expect(spies.events.createSuggestions).toHaveBeenCalled();
});

it('SHOULD say nothing WHEN the source has no token', async () => {
  spies.brapi.getCorporateEvents.mockRejectedValue(new QuoteSourceUnavailableError('brapi'));

  await setup.execute();

  expect(spies.logger.log).not.toHaveBeenCalled();
});

it('SHOULD report skipped WHEN another instance holds the lock', async () => {
  spies.events.runExclusive.mockResolvedValue(false);

  expect(await setup.execute()).toEqual({ created: 0, fetched: 0, skipped: true });
  expect(spies.brapi.getCorporateEvents).not.toHaveBeenCalled();
});
