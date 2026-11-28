import { amountVariants, buildSearchText, toActivityTerms } from './index';

describe('buildSearchText', () => {
  it('SHOULD hold the normalized label, sources and the amount variants', () => {
    const text = buildSearchText({
      amountCents: -120000,
      label: 'Mercadão',
      sources: ['Conta Corrente'],
    });

    expect(text).toContain('mercadao');
    expect(text).toContain('conta corrente');
    expect(text).toContain('120000');
    expect(text).toContain('1200,00');
    expect(text).toContain('1.200,00');
  });

  it('SHOULD include the batch item labels', () => {
    expect(buildSearchText({ itemLabels: ['Padaria', 'Posto'], label: 'Importação' })).toContain(
      'padaria',
    );
  });

  it('SHOULD omit amounts WHEN there is none', () => {
    expect(buildSearchText({ label: 'Conta' })).toBe('conta');
  });
});

describe('amountVariants', () => {
  it('SHOULD ignore the sign AND group the thousands', () => {
    expect(amountVariants(-120050)).toEqual(['120050', '1200', '1200,50', '1.200,50']);
  });
});

describe('toActivityTerms', () => {
  it('SHOULD turn "1.200,00" into the amount variant AND keep the text', () => {
    expect(toActivityTerms('1.200,00')).toEqual({ amount: '1200,00', text: '1.200,00' });
  });

  it('SHOULD normalize accents AND not read words as amounts', () => {
    expect(toActivityTerms(' Mercadão ')).toEqual({ amount: null, text: 'mercadao' });
  });
});
