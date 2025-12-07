import { UnauthorizedException } from '@nestjs/common';

import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup, throwableVerify } from './index.mocks';

describe('Method: sign', () => {
  it('SHOULD return a signed token', async () => {
    const provider = setup();

    const result = await provider.sign(mocks.data.payload);

    expect(result).toBe(mocks.data.token);
    expect(mocks.jwtService.signAsync).toHaveBeenCalledTimes(1);
    expect(mocks.jwtService.signAsync).toHaveBeenCalledWith(mocks.data.payload, {
      expiresIn: mocks.envService.jwtExpiresIn,
      secret: mocks.envService.jwtSecret,
    });
  });
});

describe('Method: verify', () => {
  it('SHOULD return the payload WHEN token is valid', async () => {
    const provider = setup();

    const result = await provider.verify(mocks.data.token);

    expect(result).toEqual(mocks.data.payload);
    expect(mocks.jwtService.verifyAsync).toHaveBeenCalledTimes(1);
    expect(mocks.jwtService.verifyAsync).toHaveBeenCalledWith(mocks.data.token, {
      secret: mocks.envService.jwtSecret,
    });
  });

  it('SHOULD throw UnauthorizedException AND log error WHEN token is invalid', async () => {
    const errorMock = new Error('jwt expired');
    mocks.jwtService.verifyAsync.mockImplementationOnce(() => {
      throw errorMock;
    });

    const result = await throwableVerify(mocks.data.token);

    expect(result).toBeInstanceOf(UnauthorizedException);
    expect((result as UnauthorizedException).message).toBe(mocks.exceptions.unauthorized.message);

    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.ERROR, 'JWT Verification failed', {
      error: errorMock.message,
      module: 'NestJwtProvider',
    });
  });

  it('SHOULD log error as string WHEN exception is not an Error instance', async () => {
    const stringError = 'Unknown error';
    mocks.jwtService.verifyAsync.mockImplementationOnce(() => {
      throw stringError;
    });

    await throwableVerify(mocks.data.token);

    expect(mocks.logger.log).toHaveBeenCalledTimes(1);
    expect(mocks.logger.log).toHaveBeenCalledWith(LogLevel.ERROR, 'JWT Verification failed', {
      error: stringError,
      module: 'NestJwtProvider',
    });
  });
});
