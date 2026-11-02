import { missingCount } from './diff';

describe('missingCount', () => {
  it('returns the part still to create', () => {
    expect(missingCount(400, 1000)).toBe(600);
    expect(missingCount(0, 3)).toBe(3);
  });

  it('never goes negative', () => {
    expect(missingCount(1000, 1000)).toBe(0);
    expect(missingCount(1200, 1000)).toBe(0);
  });
});
