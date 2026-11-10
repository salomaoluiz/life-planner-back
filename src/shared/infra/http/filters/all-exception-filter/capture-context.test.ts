import { buildCaptureContext } from './capture-context';

describe('GIVEN buildCaptureContext', () => {
  it('SHOULD tag route template, method, status, module and user', () => {
    expect(
      buildCaptureContext(
        { method: 'GET', route: { path: '/api/v1/finance/transactions/:id' }, user: { id: 'u1' } },
        500,
        'TransactionController',
      ),
    ).toEqual({
      tags: {
        method: 'GET',
        module: 'TransactionController',
        route: '/api/v1/finance/transactions/:id',
        status_code: '500',
      },
      userId: 'u1',
    });
  });

  it('SHOULD fall back when the request has no route', () => {
    expect(buildCaptureContext({}, 500).tags).toEqual({
      method: 'UNKNOWN',
      route: 'unknown',
      status_code: '500',
    });
  });

  it('SHOULD tag a family route param', () => {
    expect(buildCaptureContext({ params: { familyId: 'f1' } }, 500).tags).toMatchObject({
      family_id: 'f1',
      owner_type: 'FAMILY',
    });
  });

  it('SHOULD tag ownerId: the user, one family and several owners', () => {
    const user = { id: 'u1' };

    expect(buildCaptureContext({ query: { ownerId: 'u1' }, user }, 500).tags).toMatchObject({
      owner_type: 'USER',
    });
    expect(buildCaptureContext({ query: { ownerId: 'f1' }, user }, 500).tags).toMatchObject({
      family_id: 'f1',
      owner_type: 'FAMILY',
    });
    expect(buildCaptureContext({ query: { ownerId: ['u1', 'f1'] }, user }, 500).tags).toMatchObject(
      { owner_type: 'ALL' },
    );
  });
});
