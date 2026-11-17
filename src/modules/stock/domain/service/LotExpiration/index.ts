const DAY_MS = 86_400_000;

export interface ExpirationLot {
  expirationDate?: Date;
  openedAt?: Date;
}
export interface ExpirationRules {
  openedShelfLifeDays?: number;
  warnDaysClosed: number;
  warnDaysOpened: number;
}
export type LotStatus = 'EXPIRED' | 'EXPIRING' | 'NONE' | 'OK';

const SEVERITY: Record<LotStatus, number> = { EXPIRED: 3, EXPIRING: 2, NONE: 0, OK: 1 };

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * DAY_MS);
}
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

// Spec 116 FR 5: the earlier of the printed date and `openedAt + openedShelfLifeDays`.
export function effectiveExpiration(
  lot: ExpirationLot,
  openedShelfLifeDays?: number,
): Date | undefined {
  const afterOpening =
    lot.openedAt && openedShelfLifeDays !== undefined
      ? addDays(lot.openedAt, openedShelfLifeDays)
      : undefined;

  if (!afterOpening) {
    return lot.expirationDate;
  }

  if (!lot.expirationDate) {
    return afterOpening;
  }

  return afterOpening < lot.expirationDate ? afterOpening : lot.expirationDate;
}

// FR 20; `today` is a calendar day at UTC midnight.
export function lotStatus(lot: ExpirationLot, rules: ExpirationRules, today: Date): LotStatus {
  const expiration = effectiveExpiration(lot, rules.openedShelfLifeDays);

  if (!expiration) {
    return 'NONE';
  }

  const daysLeft = daysBetween(today, expiration);

  if (daysLeft < 0) {
    return 'EXPIRED';
  }

  return daysLeft <= (lot.openedAt ? rules.warnDaysOpened : rules.warnDaysClosed)
    ? 'EXPIRING'
    : 'OK';
}
export function worstStatus(statuses: LotStatus[]): LotStatus {
  return statuses.reduce<LotStatus>(
    (worst, status) => (SEVERITY[status] > SEVERITY[worst] ? status : worst),
    'NONE',
  );
}

// FR 6: the earliest effective expiration among the lots.
export function nearestExpiration(
  lots: ExpirationLot[],
  openedShelfLifeDays?: number,
): Date | undefined {
  return lots
    .map((lot) => effectiveExpiration(lot, openedShelfLifeDays))
    .filter((date): date is Date => date !== undefined)
    .sort((a, b) => a.getTime() - b.getTime())[0];
}
