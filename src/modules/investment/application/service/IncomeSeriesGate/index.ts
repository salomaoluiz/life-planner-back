import { Inject, Injectable, Optional } from '@nestjs/common';

import { lastDayOfMonth } from '@investment/domain/service/IncomeSeriesSchedule';
import { EnvService } from '@shared/infra/env/env.service';

export const INCOME_SERIES_GATE_CLOCK = 'INCOME_SERIES_GATE_CLOCK';

interface Entry {
  expiresAt: number;
  until: string;
}

// Spec 115 FR 18 (like spec 081): remembers, per owner, that the income series materialization already ran up to the
// end of a month, so reads inside the TTL skip it, and shares one in-flight run between concurrent reads. In-memory
// and per instance; series writes call `invalidate`. An unknown or expired owner always runs (correctness first).
@Injectable()
export class IncomeSeriesGate {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Promise<void>>();

  constructor(
    @Inject(EnvService) private readonly env: EnvService,
    @Optional() @Inject(INCOME_SERIES_GATE_CLOCK) private readonly clock: () => number = Date.now,
  ) {}

  invalidate(ownerIds: string[]): void {
    for (const ownerId of ownerIds) {
      this.entries.delete(ownerId);
    }

    this.flights.clear();
  }

  async runOnce(ownerIds: string[], today: string, task: () => Promise<void>): Promise<void> {
    const ttl = this.env.financeMaterializationGateTtlMs;
    const until = lastDayOfMonth(today);
    const owners = [...new Set(ownerIds)].sort();

    if (ttl > 0 && !this.shouldRun(owners, until)) {
      return;
    }

    const key = `${until}|${owners.join(',')}`;
    const running = this.flights.get(key);

    if (running) {
      return running;
    }

    const flight = task().then(() => {
      if (ttl > 0) {
        for (const ownerId of owners) {
          this.entries.set(ownerId, { expiresAt: this.clock() + ttl, until });
        }
      }
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

  private shouldRun(owners: string[], until: string): boolean {
    const now = this.clock();

    return owners.some((ownerId) => {
      const entry = this.entries.get(ownerId);

      return !entry || entry.until !== until || entry.expiresAt <= now;
    });
  }
}
