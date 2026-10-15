import { mocks, setup } from './index.mocks';

it('SHOULD delete the session by the HASH of the token', async () => {
  await expect(setup('x')).resolves.toBeUndefined();

  expect(mocks.sessionRepository.deleteSessionByTokenHash).toHaveBeenCalledWith('hash:x');
});

it('SHOULD resolve for an unknown token (idempotent)', async () => {
  await expect(setup('unknown')).resolves.toBeUndefined();
});

it('SHOULD reject an invalid body before touching the repository', async () => {
  await expect(setup('')).rejects.toBeDefined();

  expect(mocks.sessionRepository.deleteSessionByTokenHash).not.toHaveBeenCalled();
});
