import { buildPrefixQuery, toSearchTerms } from './index';

describe('toSearchTerms', () => {
  it('SHOULD trim, lowercase and remove accents', () => {
    expect(toSearchTerms('  Água  Fria! ')).toEqual(['agua', 'fria']);
  });

  it('SHOULD drop every tsquery operator and quote', () => {
    expect(toSearchTerms("a&b|c:*(d)'e!f")).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('SHOULD return [] for blank input', () => {
    expect(toSearchTerms('   ')).toEqual([]);
    expect(toSearchTerms('')).toEqual([]);
  });
});

describe('buildPrefixQuery', () => {
  it('SHOULD join prefix terms with &', () => {
    expect(buildPrefixQuery(['pas', 'fol'])).toBe('pas:* & fol:*');
  });
});
