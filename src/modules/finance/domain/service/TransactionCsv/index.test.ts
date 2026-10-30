import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import TransactionEntity from '@finance/domain/entity/TransactionEntity';
import { TransactionType } from '@finance/domain/enum';

import {
  csvFilename,
  formatCsvAmount,
  formatCsvDate,
  SYSTEM_CATEGORY_LABELS,
  toCsvRow,
  TRANSACTION_CSV_HEADERS,
} from './index';

function make(overrides: Partial<TransactionEntity>): TransactionEntity {
  return { ...new TransactionEntityFixture().build(), ...overrides };
}

describe('formatCsvAmount', () => {
  it('SHOULD use a comma in BR and a point in INTL, always with 2 decimals', () => {
    expect(formatCsvAmount(31240, 'BR')).toBe('312,40');
    expect(formatCsvAmount(31240, 'INTL')).toBe('312.40');
    expect(formatCsvAmount(5, 'INTL')).toBe('0.05');
    expect(formatCsvAmount(520000, 'BR')).toBe('5200,00');
  });
});

describe('formatCsvDate', () => {
  it('SHOULD write dd/mm/yyyy in BR and yyyy-mm-dd in INTL', () => {
    expect(formatCsvDate('2026-10-02', 'BR')).toBe('02/10/2026');
    expect(formatCsvDate('2026-10-02', 'INTL')).toBe('2026-10-02');
  });
});

describe('headers and labels', () => {
  it('SHOULD have 15 headers per language and a label for every system category', () => {
    expect(TRANSACTION_CSV_HEADERS['pt-BR']).toHaveLength(15);
    expect(TRANSACTION_CSV_HEADERS['en-US']).toHaveLength(15);
    expect(Object.keys(SYSTEM_CATEGORY_LABELS['pt-BR'])).toHaveLength(5);
  });

  it('SHOULD name the file by language', () => {
    expect(csvFilename('2026-01-01', '2026-12-31', 'pt-BR')).toBe(
      'transacoes-2026-01-01_2026-12-31.csv',
    );
    expect(csvFilename('2026-01-01', '2026-12-31', 'en-US')).toBe(
      'transactions-2026-01-01_2026-12-31.csv',
    );
  });
});

describe('toCsvRow', () => {
  it('SHOULD write an account row', () => {
    const transaction = make({
      creditCard: null,
      creditCardId: null,
      currency: 'BRL',
      date: '2026-10-02',
      description: 'Supermercado',
      installmentCount: null,
      installmentNumber: null,
      invoiceMonth: null,
      paid: true,
      recurrenceId: null,
      tags: [{ id: 't1', name: 'fixo' }],
      type: TransactionType.EXPENSE,
      value: 31240,
    });
    const row = toCsvRow(
      { belongsTo: 'Pessoal', categoryPath: 'Casa > Mercado', transaction },
      'BR',
      'pt-BR',
    );

    expect(row[0]).toBe('02/10/2026');
    expect(row.slice(1, 6)).toEqual(['Supermercado', 'Despesa', '312,40', 'BRL', 'Casa > Mercado']);
    expect(row[6]).toBe(transaction.account?.name ?? '');
    expect(row.slice(7)).toEqual(['', '', 'Sim', 'fixo', 'Pessoal', '', 'Não', '']);
  });

  it('SHOULD write a card purchase with its invoice, installment and recurrence', () => {
    const transaction = make({
      account: null,
      accountId: null,
      creditCard: { color: '#fff', id: 'c1', title: 'Visa' },
      creditCardId: 'c1',
      installmentCount: 10,
      installmentNumber: 3,
      invoiceMonth: '2026-11',
      paid: false,
      recurrenceId: 'r1',
      tags: [
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
      ],
    });
    const row = toCsvRow({ belongsTo: 'Family', categoryPath: 'X', transaction }, 'INTL', 'en-US');

    expect(row.slice(6)).toEqual([
      '',
      'Visa',
      '11/2026',
      'No',
      'a | b',
      'Family',
      '3/10',
      'Yes',
      '',
    ]);
  });
});

describe('notes column (spec 059)', () => {
  it('SHOULD end the header with Notes / Notas', () => {
    expect(TRANSACTION_CSV_HEADERS['en-US'].slice(-1)[0]).toBe('Notes');
    expect(TRANSACTION_CSV_HEADERS['pt-BR'].slice(-1)[0]).toBe('Notas');
  });

  it('SHOULD write the notes last, with line breaks, and leave it empty when null', () => {
    const noted = make({ notes: 'Casa\nAeroporto' });
    const plain = make({ notes: null });
    const args = { belongsTo: 'Pessoal', categoryPath: 'X' };

    expect(toCsvRow({ ...args, transaction: noted }, 'BR', 'pt-BR').slice(-1)[0]).toBe(
      'Casa\nAeroporto',
    );
    expect(toCsvRow({ ...args, transaction: plain }, 'BR', 'pt-BR').slice(-1)[0]).toBe('');
  });
});
