// The app's "today": the UTC calendar day at midnight (spec 116 FR 5, reused by the forecast, spec 123).
export function todayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}
