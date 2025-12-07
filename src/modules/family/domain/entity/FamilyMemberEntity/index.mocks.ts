import FamilyMemberEntity from './index';

// region Mocks

const dateMock = new Date('2025-12-01T10:00:00Z');

const paramsMock: FamilyMemberEntity = {
  email: 'test@example.com',
  familyId: 'family-uuid-123',
  id: 'member-uuid-456',
  joinedAt: dateMock,
  userId: 'user-uuid-789',
};

const mandatoryParamsMock: FamilyMemberEntity = {
  email: 'mandatory@example.com',
  familyId: 'family-mandatory-uuid',
  id: 'member-mandatory-uuid',
};

// endregion Mocks

// region Spies

// endregion Spies

function setup(params = paramsMock) {
  return new FamilyMemberEntity(params);
}

const mocks = {
  date: dateMock,
  mandatoryParams: mandatoryParamsMock,
  params: paramsMock,
};

const spies = {};

export { mocks, setup, spies };
