import { SemVer } from './index';
import { mocks } from './index.mocks';

describe('SemVer.parse', () => {
  it('SHOULD parse a tag with a leading v', () => {
    expect(SemVer.parse('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it.each(['1.2', 'nightly', '1.2.3-rc.1', '', 'v1.2.3.4'])('SHOULD reject "%s"', (value) => {
    expect(SemVer.parse(value)).toBeNull();
  });
});

describe('SemVer.compare', () => {
  it('SHOULD compare numerically, not lexically', () => {
    expect(SemVer.compare('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(SemVer.compare('1.0.0', '1.0.0')).toBe(0);
    expect(SemVer.compare('1.0.9', '1.1.0')).toBeLessThan(0);
  });

  it('SHOULD throw WHEN a value is not x.y.z', () => {
    expect(() => SemVer.compare('x', '1.0.0')).toThrow();
  });
});

describe('SemVer.isGreater', () => {
  it('SHOULD tell whether the first is newer', () => {
    expect(SemVer.isGreater('2.0.0', '1.9.9')).toBe(true);
    expect(SemVer.isGreater('1.0.0', '1.0.0')).toBe(false);
  });
});

describe('SemVer.highest', () => {
  it('SHOULD return the highest valid tag without the v AND ignore invalid ones', () => {
    expect(SemVer.highest(mocks.tags)).toBe('1.10.0');
  });

  it('SHOULD return null WHEN there is no valid tag', () => {
    expect(SemVer.highest(['junk'])).toBeNull();
    expect(SemVer.highest([])).toBeNull();
  });
});
