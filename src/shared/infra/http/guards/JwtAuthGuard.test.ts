import { UnauthorizedException } from '@nestjs/common';

import { mocks, setup, spies, throwableSetup } from './JwtAuthGuard.mocks';

describe('JwtAuthGuard', () => {
  it('SHOULD return true AND NOT verify token WHEN route is public', async () => {
    spies.reflectorGetAllAndOverride.mockReturnValue(true);

    const guard = setup();
    const result = await guard.canActivate(mocks.context);

    expect(result).toBe(true);
    expect(spies.reflectorGetAllAndOverride).toHaveBeenCalledTimes(1);
    expect(spies.reflectorGetAllAndOverride).toHaveBeenCalledWith(mocks.constants.IS_PUBLIC_KEY, [
      mocks.context.getHandler(),
      mocks.context.getClass(),
    ]);
    expect(spies.jwtVerify).not.toHaveBeenCalled();
  });

  it('SHOULD return true AND attach user to request WHEN token is valid', async () => {
    const guard = setup();
    const result = await guard.canActivate(mocks.context);

    expect(result).toBe(true);
    expect(spies.jwtVerify).toHaveBeenCalledTimes(1);
    expect(spies.jwtVerify).toHaveBeenCalledWith('valid_token');
    expect(mocks.request['user']).toEqual(mocks.user);
  });

  it('SHOULD throw UnauthorizedException WHEN authorization header is missing', async () => {
    mocks.switchToHttp.getRequest.mockReturnValueOnce({ headers: {} });
    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN token type is not Bearer', async () => {
    mocks.switchToHttp.getRequest.mockReturnValueOnce({
      headers: { authorization: 'Basic some_token' },
    });

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN token verification fails', async () => {
    spies.jwtVerify.mockRejectedValueOnce(new Error('Invalid token'));

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).toHaveBeenCalledTimes(1);
  });

  it('SHOULD check the token user exists AFTER the token is verified', async () => {
    await setup().canActivate(mocks.context);

    expect(spies.userExists).toHaveBeenCalledWith(mocks.user.id);
  });

  it('SHOULD NOT check the user WHEN the route is public', async () => {
    spies.reflectorGetAllAndOverride.mockReturnValue(true);

    await setup().canActivate(mocks.context);

    expect(spies.userExists).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN the token user no longer exists', async () => {
    spies.userExists.mockResolvedValueOnce(false);

    expect(await throwableSetup()).toBeInstanceOf(UnauthorizedException);
  });

  it('SHOULD throw UnauthorizedException WHEN the token payload has no user id', async () => {
    spies.jwtVerify.mockResolvedValueOnce({ user: {} } as never);

    expect(await throwableSetup()).toBeInstanceOf(UnauthorizedException);
    expect(spies.userExists).not.toHaveBeenCalled();
  });

  it('SHOULD let a lookup failure surface as a server error, NOT as 401', async () => {
    spies.userExists.mockRejectedValueOnce(new Error('db down'));

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(Error);
    expect(result).not.toBeInstanceOf(UnauthorizedException);
  });
});
