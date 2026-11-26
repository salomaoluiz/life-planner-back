import { buildUnreadEtag, matchesUnreadEtag } from './index';

const stats = { count: 3, lastCreatedAt: new Date(1000), lastReadAt: new Date(2000) };

it('SHOULD change WHEN the count, the newest notice or the latest read changes', () => {
  const etag = buildUnreadEtag('user-12345678', stats);

  expect(buildUnreadEtag('user-12345678', stats)).toBe(etag);
  expect(buildUnreadEtag('user-12345678', { ...stats, count: 2 })).not.toBe(etag);
  expect(buildUnreadEtag('user-12345678', { ...stats, lastCreatedAt: new Date(1500) })).not.toBe(
    etag,
  );
  expect(buildUnreadEtag('user-12345678', { ...stats, lastReadAt: null })).not.toBe(etag);
  expect(
    buildUnreadEtag('user-12345678', { count: 0, lastCreatedAt: null, lastReadAt: null }),
  ).toBe('"n-user-123-0-0-0"');
});

it('SHOULD match the validator, a list of them, a weak one AND the wildcard', () => {
  const etag = '"n-a-1-2-3"';

  expect(matchesUnreadEtag(etag, etag)).toBe(true);
  expect(matchesUnreadEtag(`"x", ${etag}`, etag)).toBe(true);
  expect(matchesUnreadEtag(`W/${etag}`, etag)).toBe(true);
  expect(matchesUnreadEtag('*', etag)).toBe(true);
  expect(matchesUnreadEtag('"other"', etag)).toBe(false);
  expect(matchesUnreadEtag(undefined, etag)).toBe(false);
});
