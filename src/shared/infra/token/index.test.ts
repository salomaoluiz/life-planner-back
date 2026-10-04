import { mocks, setup } from './index.mocks';

describe('generateToken', () => {
  it('SHOULD return 32 random bytes as 43 base64url characters', () => {
    const token = setup.generateToken();

    expect(token).toMatch(mocks.tokenRegex);
    expect(token).toHaveLength(43);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('SHOULD NOT repeat WHEN called many times', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => setup.generateToken()));

    expect(tokens.size).toBe(200);
  });
});

describe('hashToken', () => {
  it('SHOULD return the SHA-256 hex digest', () => {
    expect(setup.hashToken('abc')).toBe(mocks.abcHash);
  });

  it('SHOULD be deterministic AND differ from the raw token', () => {
    const token = setup.generateToken();

    expect(setup.hashToken(token)).toBe(setup.hashToken(token));
    expect(setup.hashToken(token)).not.toContain(token);
    expect(setup.hashToken(token)).toHaveLength(64);
  });
});

describe('TOKEN_REGEX', () => {
  it.each([
    ['too short', 'a'.repeat(42)],
    ['too long', 'a'.repeat(44)],
    ['standard base64 chars', `${'a'.repeat(41)}+/`],
    ['padding', `${'a'.repeat(42)}=`],
    ['empty', ''],
    ['legacy base64 JSON', Buffer.from('{"familyId":"x"}').toString('base64')],
  ])('SHOULD reject a malformed token: %s', (_label, value) => {
    expect(mocks.tokenRegex.test(value)).toBe(false);
  });
});
