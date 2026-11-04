import { Inject, Injectable, Optional } from '@nestjs/common';

import { lastDayOfMonth } from '@finance/domain/service/RecurrenceSchedule';
import { EnvService } from '@shared/infra/env/env.service';

export const MATERIALIZATION_GATE_CLOCK = 'MATERIALIZATION_GATE_CLOCK';

interface Entry {
  expiresAt: number;
  until: string;
}
interface Flight {
  owners: string[];
  promise: Promise<void>;
}

// Spec 081: remembers, per owner, that the recurrence materialization already ran up to the end of a month, so
// finance reads inside the TTL skip it, and shares one in-flight run between concurrent reads. In-memory and
// per instance. Recurrence writes call `invalidate`; an unknown or expired owner always runs (correctness first).
@Injectable()
export class MaterializationGate {
  private readonly entries = new Map<string, Entry>();
  private readonly flights = new Map<string, Flight>();
  private readonly generations = new Map<string, number>();

  constructor(
    @Inject(EnvService) private readonly env: EnvService,
    @Optional() @Inject(MATERIALIZATION_GATE_CLOCK) private readonly clock: () => number = Date.now,
  ) {}

  private generationOf(ownerId: string): number {
    return this.generations.get(ownerId) ?? 0;
  }

  invalidate(ownerIds: string[]): void {
    const owners = new Set(ownerIds);

    for (const ownerId of owners) {
      this.entries.delete(ownerId);
      this.generations.set(ownerId, this.generationOf(ownerId) + 1);
    }

    for (const [key, flight] of this.flights) {
      if (flight.owners.some((ownerId) => owners.has(ownerId))) {
        this.flights.delete(key);
      }
    }
  }

  markDone(ownerIds: string[], until: string): void {
    const ttl = this.env.financeMaterializationGateTtlMs;

    if (ttl <= 0) {
      return;
    }

    for (const ownerId of ownerIds) {
      this.entries.set(ownerId, { expiresAt: this.clock() + ttl, until });
    }
  }

  async runOnce(ownerIds: string[], today: string, task: () => Promise<void>): Promise<void> {
    if (!this.shouldRun(ownerIds, today)) {
      return;
    }

    const until = lastDayOfMonth(today);
    const owners = [...new Set(ownerIds)].sort();
    const key = `${until}|${owners.join(',')}`;
    const running = this.flights.get(key);

    if (running) {
      return running.promise;
    }

    const generations = new Map(owners.map((ownerId) => [ownerId, this.generationOf(ownerId)]));
    const flight: Flight = {
      owners,
      promise: task().then(() => {
        this.markDone(
          owners.filter((ownerId) => this.generationOf(ownerId) === generations.get(ownerId)),
          until,
        );
      }),
    };

    this.flights.set(key, flight);

    try {
      await flight.promise;
    } finally {
      if (this.flights.get(key) === flight) {
        this.flights.delete(key);
      }
    }
  }

  shouldRun(ownerIds: string[], today: string): boolean {
    if (this.env.financeMaterializationGateTtlMs <= 0) {
      return true;
    }

    const until = lastDayOfMonth(today);
    const now = this.clock();

    return ownerIds.some((ownerId) => {
      const entry = this.entries.get(ownerId);

      return !entry || entry.until !== until || entry.expiresAt <= now;
    });
  }
}
