export type AiUsageKind = 'LIGHT' | 'SEARCH';
export type IAiUsageRepository = {
  // Spec 121 FR 21: increments the counter only below `limit`, in one statement.
  // The new count, or `undefined` when the limit was already reached (nothing is written).
  consume(
    userId: string,
    kind: AiUsageKind,
    day: string,
    limit: number,
  ): Promise<number | undefined>;
  // The counters of the day (0 when there is no row).
  findDay(userId: string, day: string): Promise<Record<AiUsageKind, number>>;
};
