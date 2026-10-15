import { UserSessionMapper } from './index';
import { mocks } from './index.mocks';

describe('toDomain', () => {
  it('SHOULD map every column to the entity', () => {
    expect(UserSessionMapper.toDomain(mocks.raw)).toEqual(mocks.entity);
  });

  it('SHOULD map null columns to undefined', () => {
    const result = UserSessionMapper.toDomain(mocks.rawMinimal);

    expect(result.deviceName).toBeUndefined();
    expect(result.previousTokenHash).toBeUndefined();
    expect(result.retiredTokenHash).toBeUndefined();
    expect(result.rotatedAt).toBeUndefined();
  });
});

describe('toPersistence', () => {
  it('SHOULD map the entity back to the column names', () => {
    expect(UserSessionMapper.toPersistence(mocks.entity)).toEqual(mocks.raw);
  });

  it('SHOULD map undefined optional properties to null', () => {
    const entity = UserSessionMapper.toDomain(mocks.rawMinimal);

    expect(UserSessionMapper.toPersistence(entity)).toEqual(mocks.rawMinimal);
  });
});
