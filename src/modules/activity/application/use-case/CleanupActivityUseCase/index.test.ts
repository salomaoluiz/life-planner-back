import { CleanupActivityUseCase } from './index';

describe('CleanupActivityUseCase', () => {
  it('SHOULD delete the entries older than the retention window', async () => {
    const repository = { deleteOlderThan: jest.fn().mockResolvedValue(5) };

    await expect(
      new CleanupActivityUseCase(repository as never).execute({
        now: new Date('2026-11-27T12:00:00Z'),
        retentionDays: 183,
      }),
    ).resolves.toBe(5);
    expect(repository.deleteOlderThan).toHaveBeenCalledWith(new Date('2026-05-28T12:00:00Z'));
  });
});
