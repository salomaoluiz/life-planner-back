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

  describe('class of a B3 ticker (spec 111)', () => {
    const fii = [{ price: '9.1', ticker: 'BTHF11' }];

    it('SHOULD answer 422 TICKER_CLASS_MISMATCH WHEN a FII is saved as BR_STOCK', async () => {
      spies.brapi.getQuotes.mockResolvedValue(fii);
      spies.brapi.getKinds.mockResolvedValue({ BTHF11: 'REIT' });

      await expect(setup.validate('BR_STOCK', 'BTHF11')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      await expect(setup.validate('BR_STOCK', 'BTHF11')).rejects.toMatchObject({
        response: {
          code: 'TICKER_CLASS_MISMATCH',
          details: { expectedClass: 'BR_REIT' },
          message: '"BTHF11" is a FII on B3. Use the class REITs (FII).',
        },
      });
      expect(spies.fetcher.save).not.toHaveBeenCalled();
      expect(spies.backfill.queue).not.toHaveBeenCalled();
    });

    it('SHOULD answer 422 TICKER_CLASS_MISMATCH WHEN a stock is saved as BR_REIT', async () => {
      spies.brapi.getQuotes.mockResolvedValue(found);
      spies.brapi.getKinds.mockResolvedValue({ ITSA4: 'STOCK' });

      await expect(setup.validate('BR_REIT', 'ITSA4')).rejects.toMatchObject({
        response: {
          code: 'TICKER_CLASS_MISMATCH',
          details: { expectedClass: 'BR_STOCK' },
          message: '"ITSA4" is a stock on B3. Use the class Stocks / ETFs (B3).',
        },
      });
    });

    it('SHOULD accept the matching class AND save the quote', async () => {
      spies.brapi.getQuotes.mockResolvedValue(fii);
      spies.brapi.getKinds.mockResolvedValue({ BTHF11: 'REIT' });

      await setup.validate('BR_REIT', 'BTHF11');

      expect(spies.brapi.getKinds).toHaveBeenCalledWith('BTHF11');
      expect(spies.fetcher.save).toHaveBeenCalled();
    });

    it.each([
      ['a Fiagro', { RZAG11: 'FIAGRO' }],
      ['an unknown kind', { RZAG11: 'UNKNOWN' }],
      ['a ticker missing from the list', {}],
    ])('SHOULD accept %s under any B3 class', async (_name, kinds) => {
      spies.brapi.getQuotes.mockResolvedValue([{ price: '90', ticker: 'RZAG11' }]);
      spies.brapi.getKinds.mockResolvedValue(kinds);

      await setup.validate('BR_STOCK', 'RZAG11');
      await setup.validate('BR_REIT', 'RZAG11');

      expect(spies.fetcher.save).toHaveBeenCalledTimes(2);
    });

    it('SHOULD fail open WHEN the kind list fails', async () => {
      spies.brapi.getQuotes.mockResolvedValue(fii);
      spies.brapi.getKinds.mockRejectedValue(new Error('down'));

      await setup.validate('BR_STOCK', 'BTHF11');

      expect(spies.fetcher.save).toHaveBeenCalled();
    });

    it('SHOULD NOT read kinds for foreign stocks', async () => {
      spies.finnhub.getQuotes.mockResolvedValue([{ price: '231.4', ticker: 'AAPL' }]);

      await setup.validate('FOREIGN_STOCK', 'AAPL');

      expect(spies.brapi.getKinds).not.toHaveBeenCalled();
    });
  });
});
