import { mocks, setup } from './index.mocks';

it('SHOULD replace the invite token in a preview URL', () => {
  expect(setup(`/api/v1/family-invites/${mocks.token}`)).toBe('/api/v1/family-invites/:token');
});

it('SHOULD replace the invite token in an accept URL AND keep the suffix', () => {
  expect(setup(`/api/v1/family-invites/${mocks.token}/accept`)).toBe(
    '/api/v1/family-invites/:token/accept',
  );
});

it('SHOULD replace a malformed token too AND keep the query string', () => {
  expect(setup('/api/v1/family-invites/not-a-token?x=1')).toBe('/api/v1/family-invites/:token?x=1');
});

it('SHOULD leave unrelated URLs untouched', () => {
  expect(setup('/api/v1/families/123/members')).toBe('/api/v1/families/123/members');
  expect(setup('/api/health')).toBe('/api/health');
});
