import { Test } from '@nestjs/testing';

import { PasswordHasherRepository } from './index';

// region Mocks

const passwordMock = 'any_password';
const hashedPasswordMock = 'hashed_password';
const newHashedPasswordMock = 'new_hashed_password';

const passwordHasherMock = {
  compare: jest.fn(),
  hash: jest.fn(),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: PasswordHasherRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      PasswordHasherRepository,
      {
        provide: 'IPasswordHasher',
        useValue: passwordHasherMock,
      },
    ],
  }).compile();

  setup = module.get<PasswordHasherRepository>(PasswordHasherRepository);
});

const mocks = {
  hashedPassword: hashedPasswordMock,
  newHashedPassword: newHashedPasswordMock,
  password: passwordMock,
  passwordHasher: passwordHasherMock,
};

const spies = {};

export { mocks, setup, spies };
