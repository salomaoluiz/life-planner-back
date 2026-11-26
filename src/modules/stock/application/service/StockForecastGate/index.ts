import { Inject, Injectable, Optional } from '@nestjs/common';

import { EnvService } from '@shared/infra/env/env.service';

export const STOCK_FORECAST_GATE_CLOCK = 'STOCK_FORECAST_GATE_CLOCK';

interface Entry {
  day: string;
  expiresAt: number;
}

// Spec 123 FR 14 (081 pattern): remembers per owner that the stale forecasts of a day were already refreshed, so
// repeated reads skip the check, and shares one run between concurrent reads. In-memory and per instance; an unknown
// or expired owner always runs (correctness first).
@Injectable()
export class StockForecastGate {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Promise<void>>();

  constructor(
    @Inject(EnvService) private readonly env: EnvService,
    @Optional() @Inject(STOCK_FORECAST_GATE_CLOCK) private readonly clock: () => number = Date.now,
  ) {}

  private markDone(ownerKeys: string[], day: string): void {
    const ttl = this.env.stockForecastGateTtlMs;

    if (ttl <= 0) {
      return;
    }

    for (const ownerKey of ownerKeys) {
      this.entries.set(ownerKey, { day, expiresAt: this.clock() + ttl });
    }
  }

  async runOnce(ownerKeys: string[], day: string, task: () => Promise<void>): Promise<void> {
    if (!this.shouldRun(ownerKeys, day)) {
      return;
    }

    const owners = [...new Set(ownerKeys)].sort();
    const key = `${day}|${owners.join(',')}`;
    const running = this.flights.get(key);

    if (running) {
      return running;
    }

    const flight = task().then(() => {
      this.markDone(owners, day);
    });

    this.flights.set(key, flight);

    try {
      await flight;
    } finally {
      if (this.flights.get(key) === flight) {
        this.flights.delete(key);
      }
    }
  }

  shouldRun(ownerKeys: string[], day: string): boolean {
    if (this.env.stockForecastGateTtlMs <= 0) {
      return true;
    }

    const now = this.clock();

    return ownerKeys.some((ownerKey) => {
      const entry = this.entries.get(ownerKey);

      return !entry || entry.day !== day || entry.expiresAt <= now;
    });
  }
}
