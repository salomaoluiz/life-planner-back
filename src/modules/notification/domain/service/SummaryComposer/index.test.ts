import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';

import { composeSummary, composeUrgent, testPushTitle } from './index';

function item(
  overrides: { description?: string } & Partial<NotificationItemInput> = {},
): NotificationItemInput {
  const { description = 'Iogurte natural', ...rest } = overrides;

  return {
    dueDate: '2026-11-23',
    module: 'STOCK',
    owner: 'FAMILY' as never,
    ownerId: 'family-1',
    route: '/stock/items/item-1',
    snapshot: { description, location: 'Geladeira', ownerName: 'Casa Exemplo', valueCents: 21430 },
    sourceId: `lot-${description}`,
    state: 'DUE_TODAY',
    type: 'STOCK_EXPIRING',
    ...rest,
  };
}

describe('composeSummary', () => {
  it('SHOULD return null WHEN there is nothing to tell (nothing is created or sent)', () => {
    expect(composeSummary([], 'pt-BR')).toBeNull();
  });

  it('SHOULD order DUE_TODAY, OVERDUE, UPCOMING (by date, type, description) AND number the positions', () => {
    const notice = composeSummary(
      [
        item({ description: 'B', dueDate: '2026-11-25', state: 'UPCOMING' }),
        item({
          description: 'Z',
          dueDate: '2026-11-24',
          state: 'UPCOMING',
          type: 'FINANCE_BILL_DUE',
        }),
        item({ description: 'A', dueDate: '2026-11-24', state: 'UPCOMING' }),
        item({ description: 'Old', dueDate: '2026-11-10', state: 'OVERDUE' }),
        item({ description: 'Today', state: 'DUE_TODAY' }),
      ],
      'pt-BR',
    );

    expect(notice?.items.map((entry) => entry.snapshot.description)).toEqual([
      'Today',
      'Old',
      'A',
      'Z',
      'B',
    ]);
    expect(notice?.items.map((entry) => entry.position)).toEqual([0, 1, 2, 3, 4]);
    expect(notice?.items[0].dedupeKey).toBe('STOCK_EXPIRING:lot-Today:2026-11-23');
  });

  it('SHOULD title "Hoje: X vencem, Y nos próximos dias" WHEN urgent AND other items exist', () => {
    const notice = composeSummary(
      [
        item(),
        item({ description: 'Pão', state: 'UPCOMING' }),
        item({ description: 'Leite', state: 'UPCOMING' }),
      ],
      'pt-BR',
    );

    expect(notice?.title).toBe('Hoje: 1 vencem, 2 nos próximos dias');
  });

  it('SHOULD title "Today: N notices" in English WHEN nothing is urgent (only overdue, 13.7)', () => {
    const notice = composeSummary(
      [item({ state: 'OVERDUE' }), item({ description: 'Pão', state: 'OVERDUE' })],
      'en-US',
    );

    expect(notice?.title).toBe('Today: 2 notices');
  });

  it('SHOULD list the first 3 descriptions cut at 40 characters AND "+N" for the rest, WITHOUT amounts', () => {
    const long = 'A'.repeat(60);
    const notice = composeSummary(
      ['B', 'C', 'D', 'E']
        .map((description) => item({ description }))
        .concat(item({ description: long })),
      'pt-BR',
    );

    expect(notice?.body).toBe(`${'A'.repeat(39)}…, B, C +2`);
    expect(notice?.body).not.toContain('21430');
  });
});

describe('composeUrgent', () => {
  it('SHOULD write the stock title with the location and owner in the body', () => {
    const notice = composeUrgent(item({ description: 'Creme de leite' }), 'pt-BR');

    expect(notice.title).toBe('Vence hoje: Creme de leite');
    expect(notice.body).toBe('Geladeira · Casa Exemplo');
    expect(notice.items).toHaveLength(1);
  });

  it('SHOULD write the bill and invoice titles in both languages with the account or card name', () => {
    const bill = item({
      module: 'FINANCE',
      snapshot: { accountName: 'Conta corrente', description: 'Luz', valueCents: 100 },
      type: 'FINANCE_BILL_DUE',
    });
    const invoice = item({
      module: 'FINANCE',
      snapshot: { cardName: 'Cartão Roxo', description: 'Cartão Roxo' },
      type: 'FINANCE_INVOICE_DUE',
    });

    expect(composeUrgent(bill, 'pt-BR')).toEqual(
      expect.objectContaining({ body: 'Conta corrente', title: 'Conta vence hoje: Luz' }),
    );
    expect(composeUrgent(bill, 'en-US').title).toBe('Bill due today: Luz');
    expect(composeUrgent(invoice, 'pt-BR').title).toBe('Fatura vence hoje: Cartão Roxo');
    expect(composeUrgent(invoice, 'en-US').title).toBe('Invoice due today: Cartão Roxo');
    expect(composeUrgent(item(), 'en-US').title).toBe('Expires today: Iogurte natural');
  });
});

it('SHOULD give the test push title per locale', () => {
  expect(testPushTitle('pt-BR')).toBe('Notificações funcionando');
  expect(testPushTitle('en-US')).toBe('Notifications are working');
});
