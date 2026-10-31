import { UpcomingQuerySchema } from '@api/finance/v1/dto/upcoming.dto';

const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';

describe('UpcomingQuerySchema', () => {
  it('SHOULD default days to 7 and limit to 5', () => {
    expect(UpcomingQuerySchema.parse({ ownerId: id })).toMatchObject({ days: 7, limit: 5 });
  });

  it('SHOULD coerce days and limit from the query string', () => {
    expect(UpcomingQuerySchema.parse({ days: '10', limit: '3', ownerId: [id] })).toMatchObject({
      days: 10,
      limit: 3,
    });
  });

  it.each([
    { ownerId: undefined },
    { days: '0', ownerId: id },
    { days: '32', ownerId: id },
    { limit: '21', ownerId: id },
    { limit: '0', ownerId: id },
    { ownerId: 'x' },
    { ownerId: id, today: '2026-02-30' },
  ])('SHOULD reject %j', (query) => {
    expect(UpcomingQuerySchema.safeParse(query).success).toBe(false);
  });
});
