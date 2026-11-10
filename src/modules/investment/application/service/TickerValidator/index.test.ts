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

  it('SHOULD validate foreign stocks against Finnhub', async () => {
    spies.finnhub.getQuotes.mockResolvedValue([{ price: '231.4', ticker: 'AAPL' }]);

    await setup.validate('FOREIGN_STOCK', 'AAPL');

    expect(spies.finnhub.getQuotes).toHaveBeenCalledWith(['AAPL']);
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
