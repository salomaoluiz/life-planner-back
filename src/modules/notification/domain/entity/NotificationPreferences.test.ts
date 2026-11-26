import { defaultPreferences } from './NotificationPreferences';

it('SHOULD default to the spec values (08:00 summary, 22:00-07:00 quiet, 3 lead days)', () => {
  expect(defaultPreferences('user-1')).toEqual({
    billLeadDays: 3,
    disabledTypes: [],
    invoiceLeadDays: 3,
    lastSummaryOn: null,
    locale: 'pt-BR',
    quietEndMinute: 420,
    quietStartMinute: 1320,
    summaryMinute: 480,
    timeZone: 'America/Sao_Paulo',
    userId: 'user-1',
  });
});
