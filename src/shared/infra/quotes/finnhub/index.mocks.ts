import { EnvService } from '@shared/infra/env/env.service';

function envWith(finnhubToken?: string) {
  return { finnhubToken } as unknown as EnvService;
}

const mocks = { rawQuote: { c: 231.4, dp: 1.24, h: 232.1, l: 228.9, pc: 228.57, t: 1762272000 } };

export { envWith, mocks };
