import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { buildDataEtag, DataEtagInput, hashText, matchesEtag, ownersSignature } from './index';

const base: DataEtagInput = {
  day: '2026-11-05',
  owners: [
    { owner: OwnerType.USER, ownerId: 'user-id' },
    { archived: false, owner: OwnerType.FAMILY, ownerId: 'family-id' },
  ],
  path: '/api/v1/finance/month',
  query: 'month=2026-11&ownerId=user-id',
  userId: 'user-id',
  versions: [3, 0],
};

describe('hashText', () => {
  it('SHOULD be stable AND differ for different text', () => {
    expect(hashText('a')).toBe(hashText('a'));
    expect(hashText('a')).not.toBe(hashText('b'));
  });
});

describe('buildDataEtag', () => {
  it('SHOULD be a weak validator with the versions AND the day in it', () => {
    const etag = buildDataEtag(base);

    expect(etag).toMatch(/^W\/"[0-9a-z]+\.3-0\.[0-9a-z]+\.2026-11-05"$/);
  });

  it('SHOULD NOT depend on the order of the query parameters', () => {
    expect(buildDataEtag({ ...base, query: 'ownerId=user-id&month=2026-11' })).toBe(
      buildDataEtag(base),
    );
  });

  it.each([
    ['a write of an owner', { versions: [4, 0] }],
    ['a new day', { day: '2026-11-06' }],
    ['another query', { query: 'month=2026-12&ownerId=user-id' }],
    ['another path', { path: '/api/v1/finance/upcoming' }],
    ['another caller', { userId: 'other-user' }],
    [
      'another set of owners',
      { owners: [{ owner: OwnerType.USER, ownerId: 'user-id' }], versions: [3] },
    ],
  ])('SHOULD change WHEN there is %s', (_name, change) => {
    expect(buildDataEtag({ ...base, ...change })).not.toBe(buildDataEtag(base));
  });

  it('SHOULD change WHEN a family gets archived', () => {
    const archived = [base.owners[0], { ...base.owners[1], archived: true }];

    expect(ownersSignature(archived)).not.toBe(ownersSignature(base.owners));
  });
});

describe('matchesEtag', () => {
  const etag = 'W/"abc.1.def.2026-11-05"';

  it('SHOULD match the same validator, weak or strong form, in a list or as *', () => {
    expect(matchesEtag(etag, etag)).toBe(true);
    expect(matchesEtag('"abc.1.def.2026-11-05"', etag)).toBe(true);
    expect(matchesEtag('W/"x", W/"abc.1.def.2026-11-05"', etag)).toBe(true);
    expect(matchesEtag('*', etag)).toBe(true);
  });

  it('SHOULD NOT match another validator OR a missing header', () => {
    expect(matchesEtag('W/"other"', etag)).toBe(false);
    expect(matchesEtag(undefined, etag)).toBe(false);
    expect(matchesEtag('', etag)).toBe(false);
  });
});
