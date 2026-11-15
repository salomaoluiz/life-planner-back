import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';

import { setup, spies } from './index.mocks';

const found = [{ price: '10.53', ticker: 'ITSA4' }];

describe('TickerValidator.validate', () => {
  it('SHOULD do nothing for classes without a quote OR without a ticker', async () => {
    await setup.validate('FIXED_INCOME', 'CDB1');
    await setup.validate('BR_STOCK', null);

    expect(spies.brapi.getQuotes).not.toHaveBeenCalled();
  });

  it('SHOULD accept a B3 ticker the source knows, save its first quote AND queue the backfill', async () => {
    spies.brapi.getQuotes.mockResolvedValue(found);

    await setup.validate('BR_STOCK', 'ITSA4');

    expect(spies.brapi.getQuotes).toHaveBeenCalledWith(['ITSA4']);
    expect(spies.fetcher.save).toHaveBeenCalledWith('B3', found, expect.any(Date));
    expect(spies.backfill.queue).toHaveBeenCalledWith('B3', 'ITSA4');
  });

  it('SHOULD answer 422 TICKER_CLASS_MISMATCH WHEN a FII is saved as a stock', async () => {
    spies.brapi.getQuotes.mockResolvedValue([{ price: '152.3', ticker: 'KNRI11' }]);
    spies.brapi.getTickerKinds.mockResolvedValue({ KNRI11: 'REIT' });

    await expect(setup.validate('BR_STOCK', 'KNRI11')).rejects.toMatchObject({
      response: {
        code: 'TICKER_CLASS_MISMATCH',
        details: { expectedClass: 'BR_REIT' },
        message: '"KNRI11" is a FII on B3. Use the class FIIs.',
      },
    });
    expect(spies.brapi.getTickerKinds).toHaveBeenCalledWith('KNRI11');
    expect(spies.fetcher.save).not.toHaveBeenCalled();
    expect(spies.backfill.queue).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 TICKER_CLASS_MISMATCH WHEN a stock is saved as a FII', async () => {
    spies.brapi.getQuotes.mockResolvedValue([{ price: '45.3', ticker: 'PETR4' }]);
    spies.brapi.getTickerKinds.mockResolvedValue({ PETR4: 'STOCK' });

    await expect(setup.validate('BR_REIT', 'PETR4')).rejects.toMatchObject({
      response: {
        code: 'TICKER_CLASS_MISMATCH',
        details: { expectedClass: 'BR_STOCK' },
        message: '"PETR4" is a stock on B3. Use the class Stocks.',
      },
    });
  });

  it('SHOULD accept the ticker WHEN the source cannot tell its kind', async () => {
    spies.brapi.getQuotes.mockResolvedValue([
      { price: '10', ticker: 'RZAG11' },
      { price: '11', ticker: 'XPTO3' },
    ]);
    spies.brapi.getTickerKinds.mockResolvedValue({ RZAG11: 'FIAGRO' });

    await setup.validate('BR_STOCK', 'RZAG11');
    await setup.validate('BR_REIT', 'XPTO3');

    expect(spies.fetcher.save).toHaveBeenCalledTimes(2);
  });

  it('SHOULD accept the ticker WHEN the kind list fails', async () => {
    spies.brapi.getQuotes.mockResolvedValue([{ price: '10', ticker: 'KNRI11' }]);
    spies.brapi.getTickerKinds.mockRejectedValue(new Error('down'));

    await setup.validate('BR_STOCK', 'KNRI11');

    expect(spies.fetcher.save).toHaveBeenCalled();
  });

  it('SHOULD validate foreign stocks against Finnhub', async () => {
    spies.finnhub.getQuotes.mockResolvedValue([{ price: '231.4', ticker: 'AAPL' }]);

    await setup.validate('FOREIGN_STOCK', 'AAPL');

    expect(spies.finnhub.getQuotes).toHaveBeenCalledWith(['AAPL']);
    expect(spies.brapi.getTickerKinds).not.toHaveBeenCalled();
  });

  it('SHOULD answer 422 TICKER_NOT_FOUND WHEN the source does not return the ticker', async () => {
    spies.brapi.getQuotes.mockResolvedValue([]);

    await expect(setup.validate('BR_STOCK', 'XYZW9')).rejects.toMatchObject({
      response: { code: 'TICKER_NOT_FOUND' },
    });
    await expect(setup.validate('BR_STOCK', 'XYZW9')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(spies.fetcher.save).not.toHaveBeenCalled();
  });

  it('SHOULD answer 503 QUOTE_SOURCE_UNAVAILABLE WHEN the source fails or has no token', async () => {
    spies.brapi.getQuotes.mockRejectedValue(new Error('no token'));

    await expect(setup.validate('BR_REIT', 'HGLG11')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(setup.validate('BR_REIT', 'HGLG11')).rejects.toMatchObject({
      response: { code: 'QUOTE_SOURCE_UNAVAILABLE' },
    });
  });
});
