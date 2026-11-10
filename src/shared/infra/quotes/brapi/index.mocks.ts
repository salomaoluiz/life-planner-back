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

const mocks = { rawQuote };

export { envWith, mocks };
