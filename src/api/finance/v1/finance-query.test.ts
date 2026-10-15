import { OwnerIdQuerySchema, resolveToday, TodayQuerySchema, toOwnerIds } from './finance-query';

const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const id2 = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';

describe('OwnerIdQuerySchema', () => {
  it.each([
    ['absent', undefined],
    ['a single uuid', id],
    ['repeated uuids', [id, id2]],
  ])('SHOULD accept %s', (_label, value) => {
    expect(OwnerIdQuerySchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ['a non-uuid', 'abc'],
    ['an empty string', ''],
    ['a non-uuid inside repeated values', [id, 'abc']],
  ])('SHOULD reject %s', (_label, value) => {
    expect(OwnerIdQuerySchema.safeParse(value).success).toBe(false);
  });
});

describe('toOwnerIds', () => {
  it('SHOULD normalise absent / single / repeated values to undefined or an array', () => {
    expect(toOwnerIds(undefined)).toBeUndefined();
    expect(toOwnerIds(id)).toEqual([id]);
    expect(toOwnerIds([id, id2])).toEqual([id, id2]);
  });
});

describe('resolveToday', () => {
  afterEach(() => jest.useRealTimers());

  it('SHOULD return the given calendar date untouched', () => {
    expect(resolveToday('2026-10-15')).toBe('2026-10-15');
  });

  it('SHOULD fall back to the server UTC date WHEN none is sent', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T23:30:00.000Z'));

    expect(resolveToday(undefined)).toBe('2026-10-15');
  });
});

describe('TodayQuerySchema', () => {
  it.each(['2026-02-30', '2026-13-01', '15/10/2026', '2026-10-5', 'today'])(
    'SHOULD reject %s',
    (today) => {
      expect(TodayQuerySchema.safeParse({ today }).success).toBe(false);
    },
  );

  it('SHOULD accept a missing today AND a real date', () => {
    expect(TodayQuerySchema.safeParse({}).success).toBe(true);
    expect(TodayQuerySchema.safeParse({ today: '2028-02-29' }).success).toBe(true);
  });
});
