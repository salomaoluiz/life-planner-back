import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';

import { CacheControlInterceptor } from './index';

// region Mocks

const reflectorMock = { getAllAndOverride: jest.fn() } as unknown as Reflector;
const responseMock = { setHeader: jest.fn() };
const requestMock = { method: 'GET' };

const contextMock = {
  getClass: jest.fn(),
  getHandler: jest.fn(),
  switchToHttp: () => ({ getRequest: () => requestMock, getResponse: () => responseMock }),
} as unknown as ExecutionContext;

// endregion Mocks

// region Spies

const isPublicSpy = jest.mocked(reflectorMock.getAllAndOverride);
const setHeaderSpy = responseMock.setHeader;

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
  requestMock.method = 'GET';
  isPublicSpy.mockReturnValue(false);
});

function run(handler: CallHandler = { handle: () => of('body') }): Observable<unknown> {
  return new CacheControlInterceptor(reflectorMock).intercept(contextMock, handler);
}

const failingHandler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

const mocks = { failingHandler, request: requestMock };
const spies = { isPublic: isPublicSpy, setHeader: setHeaderSpy };

export { mocks, run, spies };
