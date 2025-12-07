import { mocks, setup, spies } from './types.mocks';

describe('UseCase', () => {
  it('SHOULD execute and return the expected output', async () => {
    const { useCase } = setup();

    const result = await useCase.execute();

    expect(spies.execute).toHaveBeenCalledTimes(1);
    expect(result).toBe(mocks.output);
  });
});

describe('UseCaseWithParams', () => {
  it('SHOULD execute with params and return the expected output', async () => {
    const { useCaseWithParams } = setup();

    const result = await useCaseWithParams.execute(mocks.input);

    expect(spies.execute).toHaveBeenCalledTimes(1);
    expect(spies.execute).toHaveBeenCalledWith(mocks.input);
    expect(result).toBe(mocks.output);
  });
});
