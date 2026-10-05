import { CreateCategoryApiSchema, UpdateCategoryApiSchema } from './category.dto';

const ownerId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const parentId = '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607';
const valid = { icon: 'cart', name: 'Groceries', owner: 'FAMILY', ownerId, type: 'EXPENSE' };

describe('CreateCategoryApiSchema', () => {
  it('SHOULD default iconColor to #000000 AND keep an optional parentId', () => {
    expect(CreateCategoryApiSchema.parse(valid)).toEqual({ ...valid, iconColor: '#000000' });
    expect(CreateCategoryApiSchema.parse({ ...valid, iconColor: '#2E7D32', parentId })).toEqual({
      ...valid,
      iconColor: '#2E7D32',
      parentId,
    });
  });

  it.each([
    ['a named color', { iconColor: 'black' }],
    ['a 3-digit hex', { iconColor: '#FFF' }],
    ['a null parentId', { parentId: null }],
    ['a non-uuid parentId', { parentId: 'abc' }],
    ['a missing type', { type: undefined }],
    ['an unknown type', { type: 'TRANSFER' }],
    ['an empty name', { name: '' }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateCategoryApiSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('SHOULD ignore a client-sent depthLevel (read-only, computed)', () => {
    const result = CreateCategoryApiSchema.parse({ ...valid, depthLevel: 9 });

    expect(result).not.toHaveProperty('depthLevel');
  });
});

describe('UpdateCategoryApiSchema', () => {
  it('SHOULD accept parentId null (make root) and any subset of fields', () => {
    expect(UpdateCategoryApiSchema.parse({ parentId: null })).toEqual({ parentId: null });
    expect(UpdateCategoryApiSchema.parse({ iconColor: '#007bff', name: ' x ' })).toEqual({
      iconColor: '#007bff',
      name: 'x',
    });
  });

  it.each([
    ['an empty body', {}],
    ['owner', { owner: 'USER' }],
    ['ownerId', { ownerId }],
    ['depthLevel (read-only)', { depthLevel: 1 }],
    ['null on a required field', { name: null }],
    ['an invalid color', { iconColor: 'red' }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateCategoryApiSchema.safeParse(body).success).toBe(false);
  });
});
