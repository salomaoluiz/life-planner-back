import { z } from 'zod';

import { validate } from './index';

type Props = Parameters<typeof validate>;

// region mocks

const schemaMock = z.object({
  testField: z.string(),
});
const dataMock = {
  testField: 'testValue',
};
const defaultProps = [schemaMock, dataMock] as Props;

// endregion mocks

// region spies

// endregion spies

beforeEach(() => {
  jest.clearAllMocks();
});

function setup(props: Props = defaultProps) {
  return validate(...props);
}
function throwableSetup(props: Props = defaultProps) {
  try {
    setup(props);
  } catch (error) {
    return error;
  }
}

const spies = {};

const mocks = {
  data: dataMock,
  defaultProps,
};

beforeEach(() => {
  jest.clearAllMocks();
});

export { mocks, setup, spies, throwableSetup };
