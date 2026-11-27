import { buildChanges } from './index';

describe('buildChanges', () => {
  it('SHOULD list only the fields that changed, with raw before and after', () => {
    expect(
      buildChanges(
        { amountCents: 230000, description: 'Mercado', paid: false },
        { amountCents: 245000, description: 'Mercado', paid: true },
        ['amountCents', 'description', 'paid'],
      ),
    ).toEqual([
      { field: 'amountCents', from: 230000, to: 245000 },
      { field: 'paid', from: false, to: true },
    ]);
  });

  it('SHOULD return an empty list WHEN nothing changed', () => {
    expect(buildChanges({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }, ['a', 'b'])).toEqual([]);
  });

  it('SHOULD ignore fields that are not listed', () => {
    expect(buildChanges({ updatedAt: 'x' }, { updatedAt: 'y' }, [])).toEqual([]);
  });

  it('SHOULD treat undefined and null as the same empty value', () => {
    expect(buildChanges({}, { notes: null }, ['notes'])).toEqual([]);
    expect(buildChanges({ notes: 'a' }, {}, ['notes'])).toEqual([
      { field: 'notes', from: 'a', to: null },
    ]);
  });
});
