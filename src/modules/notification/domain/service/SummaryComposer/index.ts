import {
  dedupeKeyOf,
  NotificationItem,
  NotificationItemInput,
} from '@notification/domain/entity/NotificationItem';
import {
  NOTIFICATION_ITEM_STATES,
  NOTIFICATION_TYPES,
  NotificationLocale,
} from '@notification/domain/enum';

export interface ComposedNotice {
  body: string;
  items: NotificationItem[];
  title: string;
}

const DESCRIPTION_LIMIT = 40;
const BODY_NAMES = 3;
const TITLE_MAX = 120;
const BODY_MAX = 300;

// Spec 124 FR 12 and 17. The push text is rendered here from the same strings the apps use.
const COPY = {
  'en-US': {
    summary: (count: number) => `Today: ${count} notices`,
    summaryUrgent: (urgent: number, upcoming: number) =>
      `Today: ${urgent} due, ${upcoming} in the next days`,
    urgentBill: (name: string) => `Bill due today: ${name}`,
    urgentInvoice: (name: string) => `Invoice due today: ${name}`,
    urgentStock: (name: string) => `Expires today: ${name}`,
  },
  'pt-BR': {
    summary: (count: number) => `Hoje: ${count} avisos`,
    summaryUrgent: (urgent: number, upcoming: number) =>
      `Hoje: ${urgent} vencem, ${upcoming} nos próximos dias`,
    urgentBill: (name: string) => `Conta vence hoje: ${name}`,
    urgentInvoice: (name: string) => `Fatura vence hoje: ${name}`,
    urgentStock: (name: string) => `Vence hoje: ${name}`,
  },
} as const;

function byOrder(a: NotificationItemInput, b: NotificationItemInput): number {
  return (
    NOTIFICATION_ITEM_STATES.indexOf(a.state) - NOTIFICATION_ITEM_STATES.indexOf(b.state) ||
    a.dueDate.localeCompare(b.dueDate) ||
    NOTIFICATION_TYPES.indexOf(a.type) - NOTIFICATION_TYPES.indexOf(b.type) ||
    a.snapshot.description.localeCompare(b.snapshot.description)
  );
}
function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// FR 10-12: DUE_TODAY first (urgent), then OVERDUE, then UPCOMING by date, type and description. `null` for no items.
export function composeSummary(
  inputs: NotificationItemInput[],
  locale: NotificationLocale,
): ComposedNotice | null {
  if (inputs.length === 0) {
    return null;
  }

  const items = [...inputs]
    .sort(byOrder)
    .map(
      (item, position): NotificationItem => ({ ...item, dedupeKey: dedupeKeyOf(item), position }),
    );
  const urgent = items.filter((item) => item.state === 'DUE_TODAY').length;
  const others = items.length - urgent;
  const copy = COPY[locale];
  const title =
    urgent > 0 && others > 0 ? copy.summaryUrgent(urgent, others) : copy.summary(items.length);
  const names = items
    .slice(0, BODY_NAMES)
    .map((item) => cut(item.snapshot.description, DESCRIPTION_LIMIT));
  const rest = items.length - BODY_NAMES;
  const body = rest > 0 ? `${names.join(', ')} +${rest}` : names.join(', ');

  return { body: cut(body, BODY_MAX), items, title: cut(title, TITLE_MAX) };
}

// FR 17: no amounts in the push (lock screens).
export function composeUrgent(
  input: NotificationItemInput,
  locale: NotificationLocale,
): ComposedNotice {
  const copy = COPY[locale];
  const name = cut(input.snapshot.description, DESCRIPTION_LIMIT);
  const title = {
    FINANCE_BILL_DUE: copy.urgentBill,
    FINANCE_INVOICE_DUE: copy.urgentInvoice,
    STOCK_EXPIRING: copy.urgentStock,
    STOCK_OPENED_EXPIRING: copy.urgentStock,
  }[input.type](name);
  const { accountName, cardName, location, ownerName } = input.snapshot;
  const body =
    input.module === 'STOCK' ? [location, ownerName] : [cardName ?? accountName, ownerName];

  return {
    body: cut(body.filter(Boolean).join(' · '), BODY_MAX),
    items: [{ ...input, dedupeKey: dedupeKeyOf(input), position: 0 }],
    title: cut(title, TITLE_MAX),
  };
}
export function testPushTitle(locale: NotificationLocale): string {
  return locale === 'en-US' ? 'Notifications are working' : 'Notificações funcionando';
}
