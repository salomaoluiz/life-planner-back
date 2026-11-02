import { checkSize, isRegression, p50 } from './stats';

describe('p50', () => {
  it('SHOULD return the middle value', () => expect(p50([5, 1, 3])).toBe(3));
  it('SHOULD return the lower median WHEN the length is even', () =>
    expect(p50([4, 1, 3, 2])).toBe(2));
});

describe('isRegression', () => {
  it('SHOULD fail WHEN over 1.25x and over the floor', () =>
    expect(isRegression(130, 100)).toBe(true));
  it('SHOULD pass WHEN under 1.25x', () => expect(isRegression(120, 100)).toBe(false));
  it('SHOULD pass WHEN under the absolute floor', () => expect(isRegression(24, 10)).toBe(false));
  it('SHOULD pass WHEN there is no baseline', () => expect(isRegression(500, null)).toBe(false));
});

describe('checkSize', () => {
  it('SHOULD fail a list over 256 KB without exception', () =>
    expect(checkSize({ bytes: 300000, kind: 'list', maxBytes: 300000 })).toContain('262144'));
  it('SHOULD accept a list with a knownException', () =>
    expect(
      checkSize({ bytes: 300000, kind: 'list', knownException: 'spec 078', maxBytes: 300000 }),
    ).toBeUndefined());
  it('SHOULD fail WHEN bytes exceed maxBytes', () => {
    const message = checkSize({ bytes: 2000, kind: 'other', maxBytes: 1000 });
    expect(message).toContain('2000');
    expect(message).toContain('1000');
  });
  it('SHOULD pass WHEN maxBytes is null', () =>
    expect(checkSize({ bytes: 2000, kind: 'other', maxBytes: null })).toBeUndefined());
});
