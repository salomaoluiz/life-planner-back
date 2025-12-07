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
    expect(spies.headersGet).toHaveBeenCalledTimes(1);
    expect(spies.headersGet).toHaveBeenCalledWith('Authorization');
    expect(spies.jwtVerify).toHaveBeenCalledTimes(1);
    expect(spies.jwtVerify).toHaveBeenCalledWith('valid_token');
    expect(mocks.request['user']).toEqual(mocks.user);
  });

  it('SHOULD throw UnauthorizedException WHEN authorization header is missing', async () => {
    spies.headersGet.mockReturnValue(undefined);

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN token type is not Bearer', async () => {
    spies.headersGet.mockReturnValue('Basic some_token');

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).not.toHaveBeenCalled();
  });

  it('SHOULD throw UnauthorizedException WHEN token verification fails', async () => {
    spies.jwtVerify.mockRejectedValue(new Error('Invalid token'));

    const result = await throwableSetup();

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect(spies.jwtVerify).toHaveBeenCalledTimes(1);
  });
});
