import { FindMeDtoSchema } from './find-me.dto';

const base = { email: 'test@example.com', id: 'user-id', name: 'Test User' };

describe('FindMeDtoSchema', () => {
  it('SHOULD accept families: []', () => {
    expect(FindMeDtoSchema.safeParse({ ...base, families: [] }).success).toBe(true);
  });

  it('SHOULD accept a family with id, name and status', () => {
    const family = { id: 'family-id', name: 'Test Family', status: 'ARCHIVED' };

    expect(FindMeDtoSchema.safeParse({ ...base, families: [family] }).success).toBe(true);
  });

  it.each([[{ id: 'family-id', name: 'Test Family' }], [{ id: 'f', name: 'n', status: 'GONE' }]])(
    'SHOULD reject the family %p',
    (family) => {
      expect(FindMeDtoSchema.safeParse({ ...base, families: [family] }).success).toBe(false);
    },
  );
});
