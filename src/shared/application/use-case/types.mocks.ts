import { UseCase, UseCaseWithParams } from './types';

// region Mocks

const inputMock = { value: 'test-input' };
const outputMock = { result: 'test-output' };

// endregion Mocks

// region Spies

const executeSpy = jest.fn().mockResolvedValue(outputMock);

// endregion Spies

class TestUseCase extends UseCase<typeof outputMock> {
  execute = executeSpy;
}
class TestUseCaseWithParams extends UseCaseWithParams<typeof inputMock, typeof outputMock> {
  execute = executeSpy;
}

function setup() {
  return {
    useCase: new TestUseCase(),
    useCaseWithParams: new TestUseCaseWithParams(),
  };
}

const mocks = {
  input: inputMock,
  output: outputMock,
};

const spies = {
  execute: executeSpy,
};

beforeEach(() => {
  jest.clearAllMocks();
});

export { mocks, setup, spies };
