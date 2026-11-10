import * as Sentry from '@sentry/nestjs';

import { buildInitOptions, captureException, initMonitoring, registerFatalHandlers } from './index';
import { mocks } from './index.mocks';

jest.mock('@sentry/nestjs', () => {
  const scope = { setTags: jest.fn(), setUser: jest.fn() };

  return {
    captureException: jest.fn(),
    flush: jest.fn(),
    init: jest.fn(),
    scope,
    withScope: jest.fn((callback: (s: unknown) => void) => callback(scope)),
  };
});

const scope = (Sentry as unknown as { scope: { setTags: jest.Mock; setUser: jest.Mock } }).scope;

beforeEach(() => jest.clearAllMocks());

describe('GIVEN the init options', () => {
  it('SHOULD never send default PII', () => {
    expect(buildInitOptions(mocks.config).sendDefaultPii).toBe(false);
  });

  it('SHOULD set the release, environment and sample rate', () => {
    expect(buildInitOptions(mocks.config)).toMatchObject({
      environment: 'test',
      release: 'life-planner-back@1.0.0',
      tracesSampleRate: 0.1,
    });
  });

  it('SHOULD be disabled without a DSN', () => {
    expect(buildInitOptions({ ...mocks.config, dsn: undefined }).enabled).toBe(false);
  });

  it('SHOULD be disabled when SENTRY_ENABLED is false', () => {
    expect(buildInitOptions({ ...mocks.config, enabled: false }).enabled).toBe(false);
  });

  it('SHOULD scrub events in beforeSend', () => {
    const options = buildInitOptions(mocks.config);
    const event = options.beforeSend?.(
      { request: { data: { a: 1 }, url: '/x?q=milk' }, user: { id: 'u1' } } as never,
      {},
    ) as { request: { data?: unknown; url: string } };

    expect(event.request.data).toBeUndefined();
    expect(event.request.url).toBe('/x?q=[redacted]');
  });

  it('SHOULD init the SDK with those options', () => {
    initMonitoring(mocks.config);

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false }));
  });
});

describe('GIVEN captureException', () => {
  it('SHOULD attach tags and the user id', () => {
    const error = new Error('boom');

    captureException(error, { tags: { route: '/a' }, userId: 'u1' });

    expect(scope.setTags).toHaveBeenCalledWith({ route: '/a' });
    expect(scope.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('SHOULD accept a non-Error value without context', () => {
    captureException('oops');

    expect(Sentry.captureException).toHaveBeenCalledWith('oops');
    expect(scope.setTags).not.toHaveBeenCalled();
  });
});

describe('GIVEN registerFatalHandlers', () => {
  function setup() {
    const handlers: Record<string, (error: unknown) => void> = {};
    const options = {
      exit: jest.fn(),
      log: jest.fn(),
      target: {
        on: jest.fn((event: string, handler: (error: unknown) => void) => {
          handlers[event] = handler;
          return process;
        }),
      } as never,
    };

    registerFatalHandlers(options);

    return { handlers, options };
  }

  it.each(['uncaughtException', 'unhandledRejection'])(
    'SHOULD capture, flush, log and exit WHEN %s fires',
    async (phase) => {
      const { handlers, options } = setup();
      const error = new Error('boom');

      handlers[phase](error);
      await new Promise((resolve) => setImmediate(resolve));

      expect(scope.setTags).toHaveBeenCalledWith({ phase });
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
      expect(Sentry.flush).toHaveBeenCalled();
      expect(options.log).toHaveBeenCalledWith(error);
      expect(options.exit).toHaveBeenCalledWith(1);
    },
  );

  it('SHOULD still log and exit WHEN the flush fails', async () => {
    const { handlers, options } = setup();
    (Sentry.flush as jest.Mock).mockRejectedValueOnce(new Error('network'));

    handlers.uncaughtException(new Error('boom'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(options.exit).toHaveBeenCalledWith(1);
  });
});
