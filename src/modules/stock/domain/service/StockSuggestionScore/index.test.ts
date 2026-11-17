import { passesThreshold, suggestionScore } from './index';

describe('suggestionScore', () => {
  it('SHOULD take the best of both signals and ignore a missing embedding', () => {
    expect(suggestionScore({ trigram: 0.4 })).toBe(0.4);
    expect(suggestionScore({ distance: 0.1, trigram: 0.4 })).toBeCloseTo(0.9);
  });
});

describe('passesThreshold', () => {
  it.each([
    [{ trigram: 0.3 }, true],
    [{ trigram: 0.29 }, false],
    [{ distance: 0.25, trigram: 0 }, true],
    [{ distance: 0.26, trigram: 0.1 }, false],
  ])('SHOULD decide %j -> %s', (signals, expected) => {
    expect(passesThreshold(signals)).toBe(expected);
  });
});
