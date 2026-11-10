// Today as a calendar day (UTC); the clock lives here so tests can fake the system time.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Spec 105: the owner's calendar day (São Paulo time) for the fixed income rules ("not in the future", maturity).
export function todayInSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(now);

  return parts;
}
