import { buildFamilyPlan, seedFamilies } from './family';

describe('buildFamilyPlan', () => {
  it('builds Perf families with example.com invites', () => {
    const plan = buildFamilyPlan(3, 2);

    expect(plan.map((family) => family.name)).toEqual([
      'Perf family 1',
      'Perf family 2',
      'Perf family 3',
    ]);
    expect(plan[0].invites).toEqual(['perf-invite-1-1@example.com', 'perf-invite-1-2@example.com']);
  });
});

describe('seedFamilies', () => {
  it('creates nothing when families and invites already exist', async () => {
    const client = {
      get: jest
        .fn()
        .mockImplementation(async (path: string) =>
          path === '/api/v1/families'
            ? [1, 2, 3].map((n) => ({ id: `f${n}`, name: `Perf family ${n}` }))
            : [
                { email: 'perf-invite-1-1@example.com' },
                { email: 'perf-invite-1-2@example.com' },
                { email: 'perf-invite-2-1@example.com' },
                { email: 'perf-invite-2-2@example.com' },
                { email: 'perf-invite-3-1@example.com' },
                { email: 'perf-invite-3-2@example.com' },
              ],
        ),
      post: jest.fn(),
    };

    const result = await seedFamilies(client as never, { families: 3, invitesPerFamily: 2 });

    expect(result).toEqual({ created: 0, familyIds: ['f1', 'f2', 'f3'] });
    expect(client.post).not.toHaveBeenCalled();
  });

  it('creates the missing family and its invites', async () => {
    const client = {
      get: jest
        .fn()
        .mockImplementation(async (path: string) =>
          path === '/api/v1/families' ? [{ id: 'f1', name: 'Perf family 1' }] : [],
        ),
      post: jest
        .fn()
        .mockImplementation(async (path: string) =>
          path === '/api/v1/families' ? { id: `new-${client.post.mock.calls.length}` } : {},
        ),
    };

    const result = await seedFamilies(client as never, { families: 2, invitesPerFamily: 1 });

    expect(result.familyIds).toHaveLength(2);
    expect(client.post).toHaveBeenCalledWith('/api/v1/families', { name: 'Perf family 2' });
    expect(client.post).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/v1\/families\/.+\/members$/),
      { email: 'perf-invite-2-1@example.com' },
    );
    expect(result.created).toBeGreaterThanOrEqual(1);
  });
});
