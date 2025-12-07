import { compare, hash } from 'bcrypt';

import { BcryptHasher } from './BcryptHasher';

// region Mocks

const passwordMock = 'any_secure_password';
const hashedPasswordMock = '$2b$10$anyhashedpassword';
const newHashMock = '$2b$10$newgeneratedhash';
const compareResultMock = true;

// endregion Mocks

// region Spies

jest.mock('bcrypt');

const compareSpy = jest.mocked(compare);
const hashSpy = jest.mocked(hash);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
});

function setup() {
  return new BcryptHasher();
}

const spies = {
  compare: compareSpy,
  hash: hashSpy,
};

const mocks = {
  compareResult: compareResultMock,
  hashedPassword: hashedPasswordMock,
  newHash: newHashMock,
  password: passwordMock,
};

export { mocks, setup, spies };
