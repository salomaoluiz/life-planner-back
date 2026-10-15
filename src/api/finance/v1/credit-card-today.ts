// "Today" for invoice status is the São Paulo calendar day (spec 026, open questions). `en-CA` formats as YYYY-MM-DD.
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
  }).format(now);
}
