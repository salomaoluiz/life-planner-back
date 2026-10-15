import { mocks, setup } from './index.mocks';

it.each([true, false])('SHOULD return %s WHEN the repository says so', async (exists) => {
  mocks.userRepository.existsById.mockResolvedValueOnce(exists);

  expect(await setup.execute(mocks.userId)).toBe(exists);
  expect(mocks.userRepository.existsById).toHaveBeenCalledWith(mocks.userId);
});

it('SHOULD propagate a repository failure', async () => {
  mocks.userRepository.existsById.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.userId)).rejects.toThrow('db down');
});
