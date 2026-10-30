import { matchesTransactionQuery, parseAmountQuery } from './index';

describe('parseAmountQuery', () => {
  it.each([
    ['38', { maxCents: 3899, minCents: 3800 }],
    ['38,7', { maxCents: 3879, minCents: 3870 }],
    ['38,70', { maxCents: 3870, minCents: 3870 }],
    ['R$ 38,70', { maxCents: 3870, minCents: 3870 }],
    ['-38.70', { maxCents: 3870, minCents: 3870 }],
    ['+38.7', { maxCents: 3879, minCents: 3870 }],
    ['1.234,56', { maxCents: 123456, minCents: 123456 }],
    ['1234.56', { maxCents: 123456, minCents: 123456 }],
    ['1.234', { maxCents: 123499, minCents: 123400 }],
    ['BRL 5', { maxCents: 599, minCents: 500 }],
    ['5 brl', { maxCents: 599, minCents: 500 }],
  ])('SHOULD read %j as an amount', (query, expected) => {
    expect(parseAmountQuery(query)).toEqual(expected);
  });

  it.each(['', 'R$', '-', '.', ',', '1.2.3', 'abc', '38,7070', 'mercado 38', '99999999999'])(
    'SHOULD NOT read %j as an amount',
    (query) => {
      expect(parseAmountQuery(query)).toBeNull();
    },
  );
});

describe('matchesTransactionQuery', () => {
  const row = {
    categoryId: 'cat-1',
    description: 'IPVA 2026',
    notes: 'Casa → Aeroporto de Guarulhos',
    valueCents: 3870,
  };
  const none = new Set<string>();

  it('SHOULD match the description, ignoring case and accents', () => {
    expect(matchesTransactionQuery(row, 'ipva', none)).toBe(true);
    expect(matchesTransactionQuery({ ...row, description: 'Padaria Pão' }, 'pao', none)).toBe(true);
  });

  it('SHOULD match the notes AND survive null notes', () => {
    expect(matchesTransactionQuery(row, 'aeroporto', none)).toBe(true);
    expect(matchesTransactionQuery({ ...row, notes: null }, 'aeroporto', none)).toBe(false);
  });

  it('SHOULD match a category found by name (the caller expands the ancestors)', () => {
    expect(matchesTransactionQuery(row, 'transporte', new Set(['cat-1']))).toBe(true);
    expect(matchesTransactionQuery(row, 'transporte', new Set(['cat-2']))).toBe(false);
  });

  it('SHOULD match the amount in cents of the absolute value', () => {
    expect(matchesTransactionQuery(row, '38,70', none)).toBe(true);
    expect(matchesTransactionQuery(row, '38', none)).toBe(true);
    expect(matchesTransactionQuery(row, '38,7', none)).toBe(true);
    expect(matchesTransactionQuery(row, '38,71', none)).toBe(false);
    expect(matchesTransactionQuery(row, '39', none)).toBe(false);
    expect(matchesTransactionQuery({ ...row, valueCents: -3870 }, '38,70', none)).toBe(true);
  });

  it('SHOULD let a numeric query still match the text', () => {
    expect(matchesTransactionQuery(row, '2026', none)).toBe(true);
  });

  it('SHOULD refuse when nothing matches AND trim the query', () => {
    expect(matchesTransactionQuery(row, 'mercado', none)).toBe(false);
    expect(matchesTransactionQuery(row, '  ipva ', none)).toBe(true);
  });
});
