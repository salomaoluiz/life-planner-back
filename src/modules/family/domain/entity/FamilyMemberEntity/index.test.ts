import FamilyMemberEntity from './index';
import { mocks, setup } from './index.mocks';

describe('FamilyMemberEntity', () => {
  it('SHOULD create an instance of FamilyMemberEntity with all properties', () => {
    const result = setup();

    expect(result).toBeInstanceOf(FamilyMemberEntity);
    expect(result).toEqual(mocks.params);
    expect(result.joinedAt).toBe(mocks.date);
    expect(result.createdAt).toBe(mocks.createdAt);
    expect(result.inviteExpiresAt).toBe(mocks.inviteExpiresAt);
  });

  it('SHOULD create an instance with only mandatory properties AND optional properties undefined', () => {
    const result = setup(mocks.mandatoryParams);

    expect(result).toBeInstanceOf(FamilyMemberEntity);
    expect(result.id).toBe(mocks.mandatoryParams.id);
    expect(result.email).toBe(mocks.mandatoryParams.email);
    expect(result.familyId).toBe(mocks.mandatoryParams.familyId);
    expect(result.createdAt).toBe(mocks.createdAt);

    // Validating optional properties are undefined
    expect(result.inviteExpiresAt).toBeUndefined();
    expect(result.joinedAt).toBeUndefined();
    expect(result.userId).toBeUndefined();
  });
});
