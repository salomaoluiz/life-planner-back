import { Test } from '@nestjs/testing';

import { JwtPayload } from '@shared/infra/jwt/types';

import { UpdateUserInput } from './dto/update-user.dto';
import { UserController } from './user.controller';
import { UserService } from './user.service';

// region Mocks

const userMock = {
  createdAt: new Date(),
  email: 'test@example.com',
  id: 'user-uuid-123',
  name: 'Test User',
  updatedAt: new Date(),
};

const updateUserInputMock: UpdateUserInput = {
  name: 'Updated Name',
};

const updatedUserMock = {
  ...userMock,
  ...updateUserInputMock,
};

const requestMock = {
  user: {
    id: 'user-uuid-123',
  },
} as JwtPayload & Request;

const userServiceMock = {
  findById: jest.fn().mockResolvedValue(userMock),
  update: jest.fn().mockResolvedValue(updatedUserMock),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: UserController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [UserController],
    providers: [
      {
        provide: UserService,
        useValue: userServiceMock,
      },
    ],
  }).compile();

  setup = module.get<UserController>(UserController);
});

const mocks = {
  request: requestMock,
  updatedUser: updatedUserMock,
  updateUserInput: updateUserInputMock,
  user: userMock,
  userService: userServiceMock,
};

const spies = {};

export { mocks, setup, spies };
