// Today as a calendar day (UTC); the clock lives here so tests can fake the system time.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
