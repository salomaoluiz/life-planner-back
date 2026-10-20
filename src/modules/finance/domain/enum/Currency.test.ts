import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@finance/domain/enum/Currency';

describe('Currency', () => {
  it('lists BRL, USD and EUR', () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual(['BRL', 'USD', 'EUR']);
  });

  it('defaults to BRL', () => {
    expect(DEFAULT_CURRENCY).toBe('BRL');
  });
});
