import { UnprocessableEntityException } from '@nestjs/common';

import { SignUpByEmailSchema } from '@user/application/dto/SignUpByEmail';

import { mocks, setup, spies, throwableSetup } from './index.mocks';

describe('GIVEN a valid SignUp request', () => {
  it('SHOULD create a user AND return the id', async () => {
    mocks.userRepository.getUserByEmail.mockResolvedValue(null);

    const useCase = await setup();
    const result = await useCase.execute(mocks.input);

    expect(spies.validate).toHaveBeenCalledTimes(1);
    expect(spies.validate).toHaveBeenCalledWith(SignUpByEmailSchema, mocks.input);

    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledWith(mocks.input.email);

    expect(mocks.passwordHasherRepository.hash).toHaveBeenCalledTimes(1);
    expect(mocks.passwordHasherRepository.hash).toHaveBeenCalledWith(mocks.input.password);

    expect(spies.userEntity).toHaveBeenCalledTimes(1);
    expect(spies.userEntity).toHaveBeenCalledWith({
      email: mocks.input.email,
      name: mocks.input.name,
      passwordHash: mocks.hashedPassword,
      photoUrl: mocks.input.photoURL,
    });

    expect(mocks.userRepository.createUser).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.createUser).toHaveBeenCalledWith(mocks.userEntityInstance);

    expect(result).toEqual({
      id: mocks.userEntityInstance.id,
    });
  });
});

describe('GIVEN a SignUp request with existing email', () => {
  it('SHOULD throw UnprocessableEntityException', async () => {
    mocks.userRepository.getUserByEmail.mockResolvedValue({ id: 'existing_id' });

    const result = await throwableSetup(mocks.input);

    expect(spies.validate).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledTimes(1);

    expect(result).toBeInstanceOf(UnprocessableEntityException);
    expect((result as UnprocessableEntityException).message).toBe('Invalid credentials');

    expect(mocks.passwordHasherRepository.hash).not.toHaveBeenCalled();
    expect(spies.userEntity).not.toHaveBeenCalled();
    expect(mocks.userRepository.createUser).not.toHaveBeenCalled();
  });
});
