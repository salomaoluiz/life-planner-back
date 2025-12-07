import { mocks, setup, spies, throwableSetup } from './index.mocks';

describe('GIVEN valid credentials', () => {
  it('SHOULD return a JWT token', async () => {
    const result = await setup();

    expect(result).toEqual({ token: mocks.data.token });
  });

  it('SHOULD validate the input data', async () => {
    await setup();

    expect(spies.validate).toHaveBeenCalledTimes(1);
    expect(spies.validate).toHaveBeenCalledWith(mocks.schemas.login, mocks.data.input);
  });

  it('SHOULD verify if user exists by email', async () => {
    await setup();

    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledWith(mocks.data.input.email);
  });

  it('SHOULD verify password hash', async () => {
    await setup();

    expect(mocks.passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(mocks.passwordHasher.compare).toHaveBeenCalledWith(
      mocks.data.input.password,
      mocks.data.user.passwordHash,
    );
  });

  it('SHOULD sign the user token', async () => {
    await setup();

    expect(mocks.jwtProvider.sign).toHaveBeenCalledTimes(1);
    expect(mocks.jwtProvider.sign).toHaveBeenCalledWith({
      user: {
        id: mocks.data.user.id,
      },
    });
  });
});

describe('GIVEN invalid credentials', () => {
  it('SHOULD throw UnauthorizedException WHEN user is not found', async () => {
    mocks.userRepository.getUserByEmail.mockResolvedValueOnce(null);

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(mocks.exceptions.unauthorized);
    expect(result).toHaveProperty('message', 'Invalid Credentials');
    expect(mocks.userRepository.getUserByEmail).toHaveBeenCalledTimes(1);
    // Ensure flow stopped before checking password
    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN password does not match', async () => {
    mocks.passwordHasher.compare.mockResolvedValueOnce(false);

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(mocks.exceptions.unauthorized);
    expect(result).toHaveProperty('message', 'Invalid Credentials');
    expect(mocks.passwordHasher.compare).toHaveBeenCalledTimes(1);
    // Ensure flow stopped before signing token
    expect(mocks.jwtProvider.sign).not.toHaveBeenCalled();
  });
});
