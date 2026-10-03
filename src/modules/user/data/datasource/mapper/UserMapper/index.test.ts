import { UserMapper } from './index';
import { mocks } from './index.mocks';

describe('UserMapper', () => {
  describe('toDomain', () => {
    it('SHOULD map every column to the entity', () => {
      const result = UserMapper.toDomain(mocks.raw);

      expect(result).toEqual({
        email: mocks.raw.email,
        id: mocks.raw.id,
        name: mocks.raw.name,
        passwordHash: mocks.raw.password_hash,
        photoUrl: mocks.raw.photo_url,
      });
    });

    it('SHOULD map a null photo_url to undefined', () => {
      const result = UserMapper.toDomain(mocks.rawWithoutPhoto);

      expect(result.photoUrl).toBeUndefined();
    });
  });

  describe('toPersistence', () => {
    it('SHOULD map every property to the column names', () => {
      const result = UserMapper.toPersistence(mocks.entity);

      expect(result).toEqual({
        created_at: null,
        email: mocks.entity.email,
        id: mocks.entity.id,
        name: mocks.entity.name,
        password_hash: mocks.entity.passwordHash,
        photo_url: mocks.entity.photoUrl,
        updated_at: null,
      });
    });

    it('SHOULD map an undefined photoUrl to null', () => {
      const result = UserMapper.toPersistence(mocks.entityWithoutPhoto);

      expect(result.photo_url).toBeNull();
    });
  });
});
