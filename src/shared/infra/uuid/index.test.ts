import { mocks, setup, spies } from './index.mocks';

it('SHOULD generate an uuid v4', () => {
  const result = setup.uuidV4();

  expect(spies.v4).toHaveBeenCalledTimes(1);
  expect(result).toEqual(mocks.uuidV4);
});

it('SHOULD generate an uuid v5', () => {
  const value = 'example.com';
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const result = setup.uuidV5(value, namespace);

  expect(spies.v5).toHaveBeenCalledTimes(1);
  expect(spies.v5).toHaveBeenCalledWith(value, namespace);
  expect(result).toEqual(mocks.uuidV5);
});
