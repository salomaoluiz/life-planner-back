import { mocks, setup, spies } from './index.mocks';
import { LogLevel } from './types';

it('SHOULD initialize the pino logger for development log level', () => {
  process.env.NODE_ENV = 'development';

  setup();

  expect(spies.pino).toHaveBeenCalledTimes(1);
  expect(spies.pino).toHaveBeenCalledWith({
    level: 'debug',
    timestamp: spies.isoTime,
    transport: {
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        singleLine: false,
        translateTime: 'SYS:standard',
      },
      target: 'pino-pretty',
    },
  });
});

it('SHOULD initialize the pino logger for non-development log level', () => {
  process.env.NODE_ENV = 'production';

  setup();

  expect(spies.pino).toHaveBeenCalledTimes(1);
  expect(spies.pino).toHaveBeenCalledWith({
    level: 'info',
    timestamp: spies.isoTime,
  });
});

const logTestCases = [
  { level: LogLevel.DEBUG, method: 'debug' },
  { level: LogLevel.ERROR, method: 'error' },
  { level: LogLevel.INFO, method: 'info' },
  { level: LogLevel.WARN, method: 'warn' },
];

test.each(logTestCases)(
  'SHOULD log a $level message using the pino logger',
  ({ level, method }) => {
    process.env.NODE_ENV = 'development';

    const logger = setup();

    const logArgs = {
      additionalInfo: 'Some extra info',
      module: 'TestModule',
    };

    logger.log(level, 'Test message', logArgs);

    expect(mocks.pino.child).toHaveBeenCalledTimes(1);
    expect(mocks.pino.child).toHaveBeenCalledWith(logArgs);
    expect(mocks.pino[method]).toHaveBeenCalledTimes(1);
    expect(mocks.pino[method]).toHaveBeenCalledWith('Test message');
  },
);
