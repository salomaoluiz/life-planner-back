import { createRng } from './random';
import { createRunners } from './runners';

describe('createRunners', () => {
  it('reports totals per type, not what the last run created', async () => {
    const client = { get: jest.fn().mockResolvedValue([]), post: jest.fn().mockResolvedValue({}) };
    const ctx = {
      cfg: {
        family: { families: 0, invitesPerFamily: 0 },
        finance: {},
        seed: 1,
        stock: { items: 3 },
      },
      client,
      familyIds: [],
      rng: createRng(1),
      today: '2026-11-02',
      userId: 'u1',
    };

    const result = await createRunners().stock(ctx as never);

    expect(result.counts).toEqual({ stock: 3 });
    expect(client.post).toHaveBeenCalledTimes(3);
  });
});
