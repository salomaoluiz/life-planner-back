import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

import { FxQuote, IFxRates, toSourceError } from '../types';

const BRAPI_CURRENCY = 'https://brapi.dev/api/v2/currency';
const AWESOME_API = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const TIMEOUT_MS = 5000;

interface AwesomeResponse {
  USDBRL?: { bid?: string; timestamp?: string };
}
interface BrapiCurrencyResponse {
  currency?: { bidPrice?: string; updatedAtTimestamp?: string }[];
}

// USD-BRL commercial rate: brapi's currency endpoint when the token plan includes it, else AwesomeAPI (no token).
function fromSeconds(value: string | undefined): Date {
  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}
// 6 places, positive; anything else is treated as "no rate".
function parseRate(value: string | undefined): null | string {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number.toFixed(6) : null;
}

@Injectable()
export class FxRates implements IFxRates {
  constructor(private readonly env: EnvService) {}

  private async fromAwesomeApi(): Promise<FxQuote> {
    try {
      const { data } = await axios.get<AwesomeResponse>(AWESOME_API, { timeout: TIMEOUT_MS });
      const rate = parseRate(data.USDBRL?.bid);
      if (!rate) {
        throw new Error('AwesomeAPI answered without a USD-BRL rate');
      }
      return { quotedAt: fromSeconds(data.USDBRL?.timestamp), rate, source: 'AWESOMEAPI' };
    } catch (error) {
      throw toSourceError(error);
    }
  }

  async getUsdBrl(): Promise<FxQuote> {
    const brapi = await this.fromBrapi();
    return brapi ?? this.fromAwesomeApi();
  }
  // Any failure falls through to the fallback: the free plan may not include the endpoint.
  private async fromBrapi(): Promise<FxQuote | null> {
    const token = this.env.brapiToken;
    if (!token) {
      return null;
    }
    try {
      const { data } = await axios.get<BrapiCurrencyResponse>(BRAPI_CURRENCY, {
        params: { currency: 'USD-BRL', token },
        timeout: TIMEOUT_MS,
      });
      const row = data.currency?.[0];
      const rate = parseRate(row?.bidPrice);
      return rate
        ? { quotedAt: fromSeconds(row?.updatedAtTimestamp), rate, source: 'BRAPI' }
        : null;
    } catch {
      return null;
    }
  }
}
