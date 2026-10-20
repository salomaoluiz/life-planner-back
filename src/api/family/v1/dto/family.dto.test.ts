import { UpdateFamilyApiSchema } from './family.dto';

describe('UpdateFamilyApiSchema', () => {
  it.each([[{ name: 'The Smiths' }], [{ status: 'ARCHIVED' }], [{ status: 'ACTIVE' }]])(
    'SHOULD accept %j',
    (body) => {
      expect(UpdateFamilyApiSchema.safeParse(body).success).toBe(true);
    },
  );

  it.each([[{}], [{ name: 'The Smiths', status: 'ARCHIVED' }], [{ status: 'DELETED' }]])(
    'SHOULD reject %j',
    (body) => {
      expect(UpdateFamilyApiSchema.safeParse(body).success).toBe(false);
    },
  );
});
