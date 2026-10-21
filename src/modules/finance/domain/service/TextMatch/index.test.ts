import { matchesText } from './index';

describe('matchesText', () => {
  it('SHOULD ignore case and accents', () => {
    expect(matchesText('MERCADÃO', 'mercadao')).toBe(true);
    expect(matchesText('Mercado da Esquina', 'mercado')).toBe(true);
  });

  it('SHOULD refuse a text that does not contain the query', () => {
    expect(matchesText('Farmácia', 'mercado')).toBe(false);
  });

  it('SHOULD trim the query', () => {
    expect(matchesText('Mercado', '  mercado ')).toBe(true);
  });
});
