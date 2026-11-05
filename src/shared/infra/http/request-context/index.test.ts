import { lastValueFrom, RequestContextStore, valueStream } from './index';

const store = new RequestContextStore<string>();

it('SHOULD expose the value only inside run', () => {
  expect(store.get()).toBeUndefined();
  expect(store.run('a', () => store.get())).toBe('a');
  expect(store.get()).toBeUndefined();
});

it('SHOULD run the handler inside the store AND call onSuccess for its value', async () => {
  const onSuccess = jest.fn();
  let seen: string | undefined;

  const result = await lastValueFrom(
    store.intercept(
      'ctx',
      {
        handle: () => {
          seen = store.get();

          return valueStream('body');
        },
      },
      onSuccess,
    ),
  );

  expect(result).toBe('body');
  expect(seen).toBe('ctx');
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

it('SHOULD NOT call onSuccess WHEN the handler fails', async () => {
  const onSuccess = jest.fn();

  await expect(
    lastValueFrom(
      store.intercept(
        'ctx',
        {
          handle: () => {
            throw new Error('boom');
          },
        },
        onSuccess,
      ),
    ),
  ).rejects.toThrow('boom');
  expect(onSuccess).not.toHaveBeenCalled();
});
