import { pino, stdTimeFunctions } from 'pino';

import { Logger } from './index';

// region Mocks

jest.mock('pino');

const pinoMock = {
  ...jest.requireActual('pino'),
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// endregion mocks

// region Spies

const pinoSpy = jest.mocked(pino).mockReturnValue(pinoMock);
const isoTimeSpy = jest.mocked(stdTimeFunctions.isoTime);

// endregion spies

beforeEach(() => {
  jest.clearAllMocks();
});

function setup() {
  return new Logger();
}

const spies = {
  isoTime: isoTimeSpy,
  pino: pinoSpy,
};

const mocks = {
  pino: pinoMock,
};

beforeEach(() => {
  jest.clearAllMocks();
});

export { mocks, setup, spies };
