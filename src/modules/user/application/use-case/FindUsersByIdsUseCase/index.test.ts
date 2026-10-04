import { mocks, setup } from './index.mocks';

it('SHOULD return ONLY id, email, name and photoUrl (never the password hash)', async () => {
  mocks.userRepository.getUsersByIds.mockResolvedValueOnce([mocks.userWithPhoto]);

  const result = await setup.execute({ ids: [mocks.userWithPhoto.id] });

  expect(result).toEqual([
    {
      email: mocks.userWithPhoto.email,
      id: mocks.userWithPhoto.id,
      name: mocks.userWithPhoto.name,
      photoUrl: 'https://example.com/p.png',
    },
  ]);
  expect(JSON.stringify(result)).not.toContain(mocks.userWithPhoto.passwordHash);
});

it('SHOULD look the users up once with de-duplicated ids', async () => {
  await setup.execute({ ids: [mocks.userA.id, mocks.userB.id, mocks.userA.id] });

  expect(mocks.userRepository.getUsersByIds).toHaveBeenCalledTimes(1);
  expect(mocks.userRepository.getUsersByIds).toHaveBeenCalledWith([mocks.userA.id, mocks.userB.id]);
});

it('SHOULD return [] WITHOUT querying WHEN the id list is empty', async () => {
  expect(await setup.execute({ ids: [] })).toEqual([]);
  expect(mocks.userRepository.getUsersByIds).not.toHaveBeenCalled();
});

it('SHOULD simply omit ids that do not exist', async () => {
  mocks.userRepository.getUsersByIds.mockResolvedValueOnce([mocks.userA]);

  const result = await setup.execute({ ids: [mocks.userA.id, 'deleted-user-id'] });

  expect(result.map((user) => user.id)).toEqual([mocks.userA.id]);
});
