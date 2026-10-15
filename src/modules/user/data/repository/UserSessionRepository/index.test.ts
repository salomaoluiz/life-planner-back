import { mocks, setup, spies } from './index.mocks';

it('SHOULD map the entity to persistence on create', async () => {
  await setup.createSession(mocks.entity);

  expect(spies.toPersistence).toHaveBeenCalledWith(mocks.entity);
  expect(mocks.datasource.create).toHaveBeenCalledWith(mocks.persistence);
});

it('SHOULD return the mapped entity WHEN a row is found', async () => {
  mocks.datasource.findByTokenHash.mockResolvedValueOnce(mocks.persistence);

  expect(await setup.findSessionByTokenHash('h')).toBe(mocks.entity);
  expect(mocks.datasource.findByTokenHash).toHaveBeenCalledWith('h');
  expect(spies.toDomain).toHaveBeenCalledWith(mocks.persistence);
});

it('SHOULD return undefined WHEN no row is found', async () => {
  mocks.datasource.findByTokenHash.mockResolvedValueOnce(null);

  expect(await setup.findSessionByTokenHash('h')).toBeUndefined();
  expect(spies.toDomain).not.toHaveBeenCalled();
});

it('SHOULD rotate through the datasource AND return its result', async () => {
  mocks.datasource.rotate.mockResolvedValueOnce(false);

  expect(await setup.rotateSession('old', mocks.entity)).toBe(false);
  expect(mocks.datasource.rotate).toHaveBeenCalledWith('old', mocks.persistence);
});

it('SHOULD delegate deletes', async () => {
  mocks.datasource.deleteExpired.mockResolvedValueOnce(2);
  const before = new Date();

  await setup.deleteSessionById('id');
  await setup.deleteSessionByTokenHash('h');

  expect(await setup.deleteExpiredSessions(before)).toBe(2);
  expect(mocks.datasource.deleteById).toHaveBeenCalledWith('id');
  expect(mocks.datasource.deleteByTokenHash).toHaveBeenCalledWith('h');
  expect(mocks.datasource.deleteExpired).toHaveBeenCalledWith(before);
});
