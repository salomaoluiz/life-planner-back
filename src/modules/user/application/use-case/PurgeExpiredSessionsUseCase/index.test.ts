import { mocks, setup } from './index.mocks';

afterEach(() => {
  jest.useRealTimers();
});

it('SHOULD delete sessions idle for longer than the TTL AND return how many', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00.000Z'));

  expect(await setup()).toBe(4);
  expect(mocks.sessionRepository.deleteExpiredSessions).toHaveBeenCalledWith(
    new Date('2026-10-13T12:00:00.000Z'),
  );
});
