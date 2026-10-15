import UserSessionEntity from './index';
import { mocks } from './index.mocks';

const now = new Date('2026-10-15T12:00:00.000Z');

describe('constructor', () => {
  it('SHOULD generate an id AND default the dates', () => {
    const session = mocks.build();

    expect(session.id).toEqual(expect.any(String));
    expect(session.lastUsedAt).toBe(session.createdAt);
    expect(session.previousTokenHash).toBeUndefined();
  });
});

describe('isIdle', () => {
  it('SHOULD be false just before the TTL AND true at the TTL', () => {
    const fresh = mocks.build({ lastUsedAt: new Date(now.getTime() - 172799_000) });
    const idle = mocks.build({ lastUsedAt: new Date(now.getTime() - 172800_000) });

    expect(fresh.isIdle(now, 172800)).toBe(false);
    expect(idle.isIdle(now, 172800)).toBe(true);
  });
});

describe('rotate (current token presented)', () => {
  it('SHOULD shift current → previous → retired and stamp the dates', () => {
    const session = mocks.build({ previousTokenHash: 'prev', tokenHash: 'cur' });

    const next = session.rotate('new', now);

    expect(next).toBeInstanceOf(UserSessionEntity);
    expect(next).toMatchObject({
      id: session.id,
      lastUsedAt: now,
      previousTokenHash: 'cur',
      retiredTokenHash: 'prev',
      rotatedAt: now,
      tokenHash: 'new',
    });
    expect(session.tokenHash).toBe('cur');
  });
});

describe('rotateAfterLostResponse (previous token presented)', () => {
  it('SHOULD replace only the current hash and keep previous and retired', () => {
    const session = mocks.build({
      previousTokenHash: 'prev',
      retiredTokenHash: 'old',
      tokenHash: 'cur',
    });

    expect(session.rotateAfterLostResponse('new', now)).toMatchObject({
      lastUsedAt: now,
      previousTokenHash: 'prev',
      retiredTokenHash: 'old',
      rotatedAt: now,
      tokenHash: 'new',
    });
  });
});

describe('matchers', () => {
  it('SHOULD match the current and the retired hash independently', () => {
    const session = mocks.build({ retiredTokenHash: 'old', tokenHash: 'cur' });

    expect(session.matchesCurrent('cur')).toBe(true);
    expect(session.matchesCurrent('old')).toBe(false);
    expect(session.matchesRetired('old')).toBe(true);
    expect(session.matchesRetired('cur')).toBe(false);
  });
});
