import { EnvService } from '@shared/infra/env/env.service';

const rawQuote = {
  logourl: 'https://example.com/itsa4.svg',
  longName: 'Itaúsa PN',
  regularMarketChangePercent: 0.48,
  regularMarketDayHigh: 10.6,
  regularMarketDayLow: 10.4,
  regularMarketPreviousClose: 10.48,
  regularMarketPrice: 10.53,
  regularMarketTime: '2026-11-04T16:00:00.000Z',
  symbol: 'ITSA4',
};

function envWith(brapiToken?: string) {
  return { brapiToken } as unknown as EnvService;
}

const rawKinds = [
  { name: 'PETROBRAS PN', stock: 'PETR4', subType: 'stock', type: 'stock' },
  { name: 'TAESA UNT', stock: 'TAEE11', subType: 'unit', type: 'stock' },
  { name: 'ISHARES IBOVESPA', stock: 'BOVA11', subType: 'etf', type: 'fund' },
  { name: 'APPLE BDR', stock: 'AAPL34', subType: 'bdr', type: 'bdr' },
  { name: 'FII KINEA', stock: 'KNRI11', subType: 'fii', type: 'fund' },
  { name: 'FIAGRO RIZA', stock: 'RZAG11', subType: 'fi-agro', type: 'fund' },
  { name: 'FI INFRA', stock: 'KDIF11', subType: 'fi-infra', type: 'fund' },
  { name: 'IBOV11', stock: 'IBOV11', subType: null, type: 'fund' },
  { name: 'ISHARES BOVA', stock: 'AAA11', subType: null, type: 'fund' },
  { name: 'FUNDO IMOBILIÁRIO X', stock: 'BBB11', subType: null, type: 'fund' },
  { name: 'FI-AGRO Y', stock: 'CCC11', subType: null, type: 'fund' },
  { name: 'SOMETHING', stock: 'DDD3', subType: null, type: 'index' },
  { name: 'BAD', stock: 'bad symbol', subType: null, type: 'stock' },
];
const mocks = { rawKinds, rawQuote };

export { envWith, mocks };
